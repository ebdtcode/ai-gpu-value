/**
 * Weekly price refresh.
 *
 * Runs every configured retailer source, keeps the lowest matching listing per
 * GPU, retailer, and condition, applies sanity and volatility guards, and
 * writes data/prices.json, data/price-history.jsonl, and data/last-run.json.
 *
 * Usage:
 *   npm run fetch:prices              refresh and write files
 *   npm run fetch:prices -- --dry-run show what would change, write nothing
 *   npm run fetch:prices -- --only=newegg,microcenter
 *
 * Exit code is 1 when every source failed, so a scheduled run that produced
 * nothing is reported as a failure instead of a quiet no-op.
 */

import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createMicroCenterSource } from './sources/microcenter.ts';
import { createNeweggSource } from './sources/newegg.ts';
import type { CatalogGpu, Listing, PriceRecord, Source, SourceResult } from './lib/types.ts';

const DATA_DIR = resolve(import.meta.dirname, '..', 'data');
const CATALOG_PATH = resolve(DATA_DIR, 'gpus.json');
const PRICES_PATH = resolve(DATA_DIR, 'prices.json');
const HISTORY_PATH = resolve(DATA_DIR, 'price-history.jsonl');
const LAST_RUN_PATH = resolve(DATA_DIR, 'last-run.json');

/** A listing outside this band of MSRP is a mismatch or a scam, not a price. */
const MIN_MSRP_RATIO = 0.4;
const MAX_MSRP_RATIO = 3.0;
/** A week-over-week move larger than this is held for a human to look at. */
const MAX_WEEKLY_CHANGE = 0.4;

interface HeldPrice {
  slug: string;
  retailer: string;
  condition: string;
  previous: number;
  proposed: number;
  productName: string;
  url: string;
}

interface SourceSummary {
  status: 'ok' | 'partial' | 'failed';
  pagesFetched: number;
  listings: number;
  gpusPriced: number;
  errors: string[];
}

interface LastRun {
  ranAt: string;
  dryRun: boolean;
  sources: Record<string, SourceSummary>;
  held: HeldPrice[];
  rejected: string[];
}

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const onlyArg = [...args].find((a) => a.startsWith('--only='));
const only = onlyArg ? new Set(onlyArg.slice('--only='.length).split(',')) : null;

const ALL_SOURCES: Source[] = [createMicroCenterSource(), createNeweggSource()];
const sources = only ? ALL_SOURCES.filter((s) => only.has(s.retailer)) : ALL_SOURCES;

async function main(): Promise<number> {
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8')) as CatalogGpu[];
  const existing = JSON.parse(readFileSync(PRICES_PATH, 'utf8')) as PriceRecord[];
  const msrp = new Map(catalog.map((g) => [g.slug, g.msrpUsd]));
  const ranAt = new Date().toISOString();

  const run: LastRun = { ranAt, dryRun, sources: {}, held: [], rejected: [] };
  const accepted: PriceRecord[] = [];
  const touched = new Set<string>();

  for (const source of sources) {
    console.log(`\n[${source.retailer}] fetching...`);
    let result: SourceResult;
    try {
      result = await source.run(catalog);
    } catch (error) {
      result = { retailer: source.retailer, listings: [], pagesFetched: 0, errors: [String(error)] };
    }

    // Drop listings outside the MSRP band before choosing, so a scalper
    // listing that happens to be in stock cannot hide a sane one.
    const plausible = result.listings.filter((listing) => {
      const ref = msrp.get(listing.slug);
      if (ref === undefined) return false;
      const ratio = listing.priceUsd / ref;
      if (ratio >= MIN_MSRP_RATIO && ratio <= MAX_MSRP_RATIO) return true;
      run.rejected.push(`${keyOf(listing)}: ${listing.priceUsd} is ${ratio.toFixed(2)}x MSRP (${listing.productName})`);
      return false;
    });
    const best = pickLowest(plausible);
    const priced = new Set<string>();

    for (const listing of best) {
      const key = keyOf(listing);
      const previous = existing.find((p) => keyOf(p) === key);
      if (previous && Math.abs(listing.priceUsd - previous.priceUsd) / previous.priceUsd > MAX_WEEKLY_CHANGE) {
        run.held.push({
          slug: listing.slug,
          retailer: listing.retailer,
          condition: listing.condition,
          previous: previous.priceUsd,
          proposed: listing.priceUsd,
          productName: listing.productName,
          url: listing.url,
        });
        continue;
      }
      accepted.push({
        slug: listing.slug,
        retailer: listing.retailer,
        condition: listing.condition,
        priceUsd: listing.priceUsd,
        url: listing.url,
        inStock: listing.inStock,
        fetchedAt: ranAt,
        productName: listing.productName,
      });
      touched.add(key);
      priced.add(listing.slug);
    }

    const status: SourceSummary['status'] =
      result.pagesFetched === 0 ? 'failed' : result.errors.length > 0 ? 'partial' : 'ok';
    run.sources[source.retailer] = {
      status,
      pagesFetched: result.pagesFetched,
      listings: result.listings.length,
      gpusPriced: priced.size,
      errors: result.errors,
    };
    console.log(
      `[${source.retailer}] ${status}: ${result.pagesFetched} pages, ${result.listings.length} matching listings, ${priced.size} GPUs priced` +
        (result.errors.length ? `, ${result.errors.length} errors` : '')
    );
    for (const err of result.errors.slice(0, 5)) console.log(`  ! ${err}`);
  }

  // Merge: records refreshed this run replace their predecessors, all others stay.
  const merged = existing.filter((p) => !touched.has(keyOf(p))).concat(accepted);
  merged.sort((a, b) => a.slug.localeCompare(b.slug) || a.retailer.localeCompare(b.retailer) || a.condition.localeCompare(b.condition));

  printChanges(existing, accepted);
  if (run.held.length) {
    console.log('\nHeld for review (change over 40 percent):');
    for (const h of run.held) console.log(`  ${h.slug} ${h.retailer} ${h.condition}: ${h.previous} -> ${h.proposed}  ${h.url}`);
  }
  if (run.rejected.length) {
    console.log(`\nRejected ${run.rejected.length} listings outside the MSRP band (full list in data/last-run.json).`);
  }

  const succeeded = Object.values(run.sources).filter((s) => s.status !== 'failed').length;

  if (dryRun) {
    console.log('\nDry run: nothing written.');
  } else {
    writeFileSync(PRICES_PATH, JSON.stringify(merged, null, 2) + '\n');
    const historyLines = accepted
      .map((p) => JSON.stringify({ date: ranAt.slice(0, 10), slug: p.slug, retailer: p.retailer, condition: p.condition, priceUsd: p.priceUsd, inStock: p.inStock }))
      .join('\n');
    if (historyLines) appendFileSync(HISTORY_PATH, historyLines + '\n');
    writeFileSync(LAST_RUN_PATH, JSON.stringify(run, null, 2) + '\n');
    console.log(`\nWrote ${accepted.length} prices to ${PRICES_PATH}`);
  }

  if (succeeded === 0) {
    console.error('\nAll sources failed.');
    return 1;
  }
  return 0;
}

function keyOf(p: { slug: string; retailer: string; condition: string }): string {
  return `${p.slug}|${p.retailer}|${p.condition}`;
}

/** Lowest in-stock listing per key; lowest out-of-stock listing when none is in stock. */
function pickLowest(listings: Listing[]): Listing[] {
  const best = new Map<string, Listing>();
  for (const l of listings) {
    const key = keyOf(l);
    const current = best.get(key);
    if (!current) {
      best.set(key, l);
      continue;
    }
    if (l.inStock !== current.inStock) {
      if (l.inStock) best.set(key, l);
      continue;
    }
    if (l.priceUsd < current.priceUsd) best.set(key, l);
  }
  return [...best.values()];
}

function printChanges(existing: PriceRecord[], accepted: PriceRecord[]): void {
  console.log('\nChanges:');
  let shown = 0;
  for (const p of accepted) {
    const prev = existing.find((e) => keyOf(e) === keyOf(p));
    const stock = p.inStock ? '' : ' (out of stock)';
    if (!prev) {
      console.log(`  + ${p.slug} ${p.retailer}: ${p.priceUsd}${stock}`);
      shown++;
    } else if (prev.priceUsd !== p.priceUsd || prev.inStock !== p.inStock) {
      console.log(`  ~ ${p.slug} ${p.retailer}: ${prev.priceUsd} -> ${p.priceUsd}${stock}`);
      shown++;
    }
  }
  if (shown === 0) console.log('  none');
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
