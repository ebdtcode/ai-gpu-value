/**
 * Micro Center: graphics card category listing for one store.
 *
 * Micro Center prices are per store and most cards are in-store pickup only,
 * so the store id is part of the recorded URL. Two pages of 96 cover the
 * whole category. Product name, price, and link come from data attributes
 * on the product heading; stock comes from the listing text.
 */

import { decodeEntities, fetchPage } from '../lib/http.ts';
import { matchTitle } from '../lib/match.ts';
import type { CatalogGpu, Listing, Source, SourceResult } from '../lib/types.ts';

const BASE = 'https://www.microcenter.com';
const CATEGORY_ID = '4294966937';
const PAGE_SIZE = 96;
const MAX_PAGES = 3;

export function createMicroCenterSource(storeId = process.env.MICROCENTER_STORE_ID || '095'): Source {
  return {
    retailer: 'microcenter',
    async run(_catalog: CatalogGpu[]): Promise<SourceResult> {
      const result: SourceResult = { retailer: 'microcenter', listings: [], pagesFetched: 0, errors: [] };
      let pages = MAX_PAGES;
      for (let page = 1; page <= pages; page++) {
        const url = `${BASE}/search/search_results.aspx?N=${CATEGORY_ID}&NTK=all&sortby=match&rpp=${PAGE_SIZE}&page=${page}&storeid=${storeId}`;
        let html: string;
        try {
          html = await fetchPage(url);
        } catch (error) {
          result.errors.push(error instanceof Error ? error.message : String(error));
          break;
        }
        result.pagesFetched++;
        const listings = parseMicroCenterPage(html, storeId);
        result.listings.push(...listings.matched);
        if (page === 1) {
          // The listing reports its own total, for example "167 items".
          const total = listings.itemCount ?? listings.total;
          pages = Math.min(MAX_PAGES, Math.max(1, Math.ceil(total / PAGE_SIZE)));
        }
        if (listings.total === 0) break;
      }
      return result;
    },
  };
}

export function parseMicroCenterPage(
  html: string,
  storeId: string
): { total: number; itemCount: number | null; matched: Listing[] } {
  const blocks = html.split('class="product_wrapper"').slice(1);
  const countMatch = html.match(/([0-9,]+)\s+items\b/i);
  const itemCount = countMatch ? Number.parseInt(countMatch[1].replace(/,/g, ''), 10) : null;
  const matched: Listing[] = [];
  for (const block of blocks) {
    const anchor = block.match(/<a id="hypProductH2_\d+"([^>]*)>/);
    if (!anchor) continue;
    const attrs = anchor[1];
    const name = decodeEntities(attr(attrs, 'data-name'));
    const brand = decodeEntities(attr(attrs, 'data-brand'));
    const priceText = attr(attrs, 'data-price');
    const href = attr(attrs, 'href');
    const price = Number.parseFloat(priceText);
    if (!name || !href || !Number.isFinite(price) || price <= 0) continue;

    const slug = matchTitle(`${brand} ${name}`);
    if (!slug) continue;

    const text = block.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const inStock = /\bin stock\b/i.test(text) && !/\bsold out\b/i.test(text);

    matched.push({
      slug,
      retailer: 'microcenter',
      condition: 'new',
      priceUsd: price,
      url: `${BASE}${href}?storeid=${storeId}`,
      inStock,
      productName: brand ? `${brand} ${name}` : name,
    });
  }
  return { total: blocks.length, itemCount, matched };
}

function attr(attrs: string, key: string): string {
  const match = attrs.match(new RegExp(`${key}="([^"]*)"`));
  return match ? match[1] : '';
}
