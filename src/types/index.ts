// GPU Types for AIGPUValue.com

export interface GPU {
  id: string;
  slug: string;
  name: string;
  brand: 'NVIDIA' | 'AMD' | 'Intel';
  model: string;
  architecture: string;
  vramGb: number;
  vramType: string;
  memoryBandwidthGbps: number;
  cudaCores?: number;
  streamProcessors?: number;
  tensorCores?: number;
  xeCores?: number;
  baseClockMhz: number;
  boostClockMhz: number;
  tdpWatts: number;
  releaseDate: string;
  msrpUsd: number;
  imageUrl?: string;
}

export interface AIBenchmark {
  gpuId: string;
  sd15ImgsPerMin?: number;
  sdxlImgsPerMin?: number;
  fluxImgsPerMin?: number;
  llm7bTokensPerSec?: number;
  llm13bTokensPerSec?: number;
  llm70bTokensPerSec?: number;
  maxModelSizeBillions?: number;
  benchmarkSource: string;
  benchmarkDate: string;
}

export interface Price {
  gpuId: string;
  retailer: 'amazon' | 'newegg' | 'ebay' | 'bhphoto' | 'bestbuy' | 'nvidia';
  condition: 'new' | 'used' | 'refurbished' | 'open-box';
  priceUsd: number;
  url: string;
  affiliateUrl: string;
  inStock: boolean;
  fetchedAt: string;
}

export interface GPUWithData extends GPU {
  benchmarks?: AIBenchmark;
  prices: Price[];
  valueScore: number;
  lowestNewPrice?: number;
  lowestUsedPrice?: number;
}

export type ValueRating = 'excellent' | 'good' | 'fair';

export interface FilterState {
  vramMin?: number;
  vramMax?: number;
  priceMin?: number;
  priceMax?: number;
  brands: ('NVIDIA' | 'AMD' | 'Intel')[];
  sortBy: 'value' | 'price-asc' | 'price-desc' | 'vram' | 'performance';
  condition: 'all' | 'new' | 'used';
}

export type Theme = 'light' | 'dark' | 'system';

// Utility functions
export function getValueRating(score: number): ValueRating {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  return 'fair';
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}
