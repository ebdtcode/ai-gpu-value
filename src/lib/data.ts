/**
 * Site data layer.
 *
 * The catalog (specs and benchmarks) and the price table are committed JSON
 * files under data/. The weekly refresh job rewrites data/prices.json; the
 * build reads both files, so the site never depends on a live database.
 *
 * A price older than MAX_PRICE_AGE_DAYS is kept for display as "last seen"
 * but is excluded from best-price figures, value scores, and deals.
 */

import catalog from '../../data/gpus.json';
import priceRows from '../../data/prices.json';
import type { AIBenchmark, GPU, GPUWithData, Price } from '../types';

export const MAX_PRICE_AGE_DAYS = 45;

type CatalogRow = GPU & { benchmarks?: Omit<AIBenchmark, 'gpuId'> };

interface PriceRow {
  slug: string;
  retailer: Price['retailer'];
  condition: Price['condition'];
  priceUsd: number;
  url: string;
  inStock: boolean;
  fetchedAt: string;
  productName?: string;
}

const rows = catalog as unknown as CatalogRow[];
const prices = priceRows as unknown as PriceRow[];

const staleBefore = Date.now() - MAX_PRICE_AGE_DAYS * 24 * 60 * 60 * 1000;

function isStale(fetchedAt: string): boolean {
  const t = Date.parse(fetchedAt);
  return !Number.isFinite(t) || t < staleBefore;
}

function toPrice(row: PriceRow, gpuId: string): Price {
  return {
    gpuId,
    retailer: row.retailer,
    condition: row.condition,
    priceUsd: row.priceUsd,
    url: row.url,
    affiliateUrl: row.url,
    inStock: row.inStock,
    fetchedAt: row.fetchedAt,
    productName: row.productName,
    isStale: isStale(row.fetchedAt),
  };
}

/** Fresh in-stock first by price, then fresh out-of-stock, then stale. */
function sortPrices(list: Price[]): Price[] {
  return [...list].sort((a, b) => {
    if (a.isStale !== b.isStale) return a.isStale ? 1 : -1;
    if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;
    return a.priceUsd - b.priceUsd;
  });
}

function lowest(list: Price[], condition: Price['condition']): number | undefined {
  const candidates = list.filter((p) => p.condition === condition && p.inStock && !p.isStale);
  if (candidates.length === 0) return undefined;
  return Math.min(...candidates.map((p) => p.priceUsd));
}

function valueScore(gpu: GPU, benchmarks: AIBenchmark | undefined, referencePrice: number): number {
  const sdxlScore = (benchmarks?.sdxlImgsPerMin ?? 0) * 4;
  const llmScore = (benchmarks?.llm7bTokensPerSec ?? 0) * 0.3;
  const vramScore = gpu.vramGb * 2;
  const raw = ((sdxlScore + llmScore + vramScore) * 100) / referencePrice;
  return Math.min(100, Math.max(0, Math.round(raw)));
}

function build(row: CatalogRow): GPUWithData {
  const id = row.slug;
  const gpuPrices = sortPrices(prices.filter((p) => p.slug === row.slug).map((p) => toPrice(p, id)));
  const benchmarks = row.benchmarks ? { gpuId: id, ...row.benchmarks } : undefined;
  const { benchmarks: _omit, ...gpu } = row;
  const lowestNewPrice = lowest(gpuPrices, 'new');
  const lowestUsedPrice = lowest(gpuPrices, 'used');
  const referencePrice = lowestUsedPrice ?? lowestNewPrice ?? gpu.msrpUsd;
  return {
    ...gpu,
    id,
    benchmarks,
    prices: gpuPrices,
    valueScore: valueScore(gpu, benchmarks, referencePrice),
    lowestNewPrice,
    lowestUsedPrice,
  };
}

const all: GPUWithData[] = rows.map(build).sort((a, b) => a.name.localeCompare(b.name));

export function getAllGPUs(): GPUWithData[] {
  return all;
}

export function getGPUBySlug(slug: string): GPUWithData | null {
  return all.find((g) => g.slug === slug) ?? null;
}

export function getAllGPUSlugs(): string[] {
  return all.map((g) => g.slug);
}

export interface DataFreshness {
  /** Newest fetch time across prices that still count as current, or null. */
  pricesUpdatedAt: Date | null;
  /** Retailers with at least one current price. */
  retailers: string[];
}

export function getDataFreshness(): DataFreshness {
  const fresh = prices.filter((p) => !isStale(p.fetchedAt));
  if (fresh.length === 0) return { pricesUpdatedAt: null, retailers: [] };
  const newest = Math.max(...fresh.map((p) => Date.parse(p.fetchedAt)));
  return {
    pricesUpdatedAt: new Date(newest),
    retailers: [...new Set(fresh.map((p) => p.retailer))].sort(),
  };
}

/** Newest fetch time among a GPU's current prices, or null when all are stale. */
export function latestPriceCheck(gpu: GPUWithData): Date | null {
  const fresh = gpu.prices.filter((p) => !p.isStale);
  if (fresh.length === 0) return null;
  return new Date(Math.max(...fresh.map((p) => Date.parse(p.fetchedAt))));
}

export function formatDate(date: Date, withYear = true): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}

export const RETAILER_LABELS: Record<Price['retailer'], string> = {
  amazon: 'Amazon',
  newegg: 'Newegg',
  ebay: 'eBay',
  bhphoto: 'B&H Photo',
  bestbuy: 'Best Buy',
  nvidia: 'NVIDIA',
  microcenter: 'Micro Center',
};

export function retailerLabel(retailer: string): string {
  return RETAILER_LABELS[retailer as Price['retailer']] ?? retailer;
}
