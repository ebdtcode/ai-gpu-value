/**
 * Newegg: one search per catalog GPU, restricted to the graphics card category.
 *
 * Newegg embeds each result as JSON in the page. Every "ItemCell" object
 * carries the item number, final price, title, and stock flag, so the parser
 * extracts those objects by brace matching instead of reading the HTML.
 */

import { fetchPage } from '../lib/http.ts';
import { matchTitle, ruleFor } from '../lib/match.ts';
import type { CatalogGpu, Listing, Source, SourceResult } from '../lib/types.ts';

const BASE = 'https://www.newegg.com';
const GPU_CATEGORY = '100007709';
const PAGE_SIZE = 96;

interface ItemCell {
  Item?: string;
  FinalPrice?: number | string;
  Instock?: boolean;
  Description?: { Title?: string };
}

export function createNeweggSource(): Source {
  return {
    retailer: 'newegg',
    async run(catalog: CatalogGpu[]): Promise<SourceResult> {
      const result: SourceResult = { retailer: 'newegg', listings: [], pagesFetched: 0, errors: [] };
      for (const gpu of catalog) {
        const rule = ruleFor(gpu.slug);
        if (!rule) continue;
        const url = `${BASE}/p/pl?d=${encodeURIComponent(rule.query)}&N=${GPU_CATEGORY}&PageSize=${PAGE_SIZE}`;
        let html: string;
        try {
          html = await fetchPage(url);
        } catch (error) {
          result.errors.push(`${gpu.slug}: ${error instanceof Error ? error.message : String(error)}`);
          // Several consecutive failures usually mean a bot challenge; stop early.
          if (result.errors.length >= 3 && result.pagesFetched === 0) break;
          continue;
        }
        result.pagesFetched++;
        if (/areyouahuman|Are you a human/i.test(html)) {
          result.errors.push(`${gpu.slug}: bot challenge page`);
          break;
        }
        result.listings.push(...parseNeweggPage(html).filter((l) => l.slug === gpu.slug));
      }
      return result;
    },
  };
}

export function parseNeweggPage(html: string): Listing[] {
  const listings: Listing[] = [];
  const marker = '"ItemCell":';
  let from = 0;
  for (;;) {
    const at = html.indexOf(marker, from);
    if (at === -1) break;
    const start = at + marker.length;
    const end = findObjectEnd(html, start);
    from = end > start ? end : start;
    if (end === -1) continue;
    let cell: ItemCell;
    try {
      cell = JSON.parse(html.slice(start, end)) as ItemCell;
    } catch {
      continue;
    }
    const title = cell.Description?.Title ?? '';
    const price = typeof cell.FinalPrice === 'string' ? Number.parseFloat(cell.FinalPrice) : cell.FinalPrice;
    if (!cell.Item || !title || typeof price !== 'number' || !Number.isFinite(price) || price <= 0) continue;
    const slug = matchTitle(title);
    if (!slug) continue;
    listings.push({
      slug,
      retailer: 'newegg',
      condition: 'new',
      priceUsd: price,
      url: `${BASE}/p/${cell.Item}`,
      inStock: cell.Instock !== false,
      productName: title,
    });
  }
  return listings;
}

/** Index just past the JSON object that starts at `start` (which must be `{`). */
function findObjectEnd(text: string, start: number): number {
  if (text[start] !== '{') return -1;
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}
