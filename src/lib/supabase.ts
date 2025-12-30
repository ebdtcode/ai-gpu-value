import { createClient } from '@supabase/supabase-js';
import type { GPUWithData } from '../types';

// Supabase client configuration
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not configured. Using fallback data.');
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Database types matching our schema
export interface DBGpu {
  id: string;
  slug: string;
  name: string;
  brand: 'NVIDIA' | 'AMD' | 'Intel';
  model: string;
  architecture: string;
  vram_gb: number;
  vram_type: string;
  memory_bandwidth_gbps: number;
  cuda_cores: number | null;
  stream_processors: number | null;
  tensor_cores: number | null;
  xe_cores: number | null;
  base_clock_mhz: number;
  boost_clock_mhz: number;
  tdp_watts: number;
  release_date: string;
  msrp_usd: number;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface DBBenchmark {
  id: string;
  gpu_id: string;
  sd15_imgs_per_min: number | null;
  sdxl_imgs_per_min: number | null;
  flux_imgs_per_min: number | null;
  llm7b_tokens_per_sec: number | null;
  llm13b_tokens_per_sec: number | null;
  llm70b_tokens_per_sec: number | null;
  max_model_size_billions: number | null;
  benchmark_source: string | null;
  benchmark_date: string | null;
}

export interface DBPrice {
  id: string;
  gpu_id: string;
  retailer: string;
  condition: 'new' | 'used' | 'refurbished' | 'open-box';
  price_usd: number;
  url: string;
  affiliate_url: string | null;
  in_stock: boolean;
  fetched_at: string;
}

// Transform database GPU to application format
function transformGpu(
  gpu: DBGpu,
  benchmarks: DBBenchmark | null,
  prices: DBPrice[]
): GPUWithData {
  const lowestNewPrice = prices
    .filter(p => p.condition === 'new' && p.in_stock)
    .reduce((min, p) => Math.min(min, p.price_usd), Infinity);

  const lowestUsedPrice = prices
    .filter(p => p.condition === 'used' && p.in_stock)
    .reduce((min, p) => Math.min(min, p.price_usd), Infinity);

  // Calculate value score
  const referencePrice = lowestUsedPrice !== Infinity ? lowestUsedPrice : (lowestNewPrice !== Infinity ? lowestNewPrice : gpu.msrp_usd);
  const sdxlScore = (benchmarks?.sdxl_imgs_per_min || 0) * 4;
  const llmScore = (benchmarks?.llm7b_tokens_per_sec || 0) * 0.3;
  const vramScore = gpu.vram_gb * 2;
  const rawValueScore = ((sdxlScore + llmScore + vramScore) * 100) / referencePrice;
  const valueScore = Math.min(100, Math.max(0, Math.round(rawValueScore)));

  return {
    id: gpu.id,
    slug: gpu.slug,
    name: gpu.name,
    brand: gpu.brand,
    model: gpu.model,
    architecture: gpu.architecture,
    vramGb: gpu.vram_gb,
    vramType: gpu.vram_type,
    memoryBandwidthGbps: gpu.memory_bandwidth_gbps,
    cudaCores: gpu.cuda_cores || undefined,
    streamProcessors: gpu.stream_processors || undefined,
    tensorCores: gpu.tensor_cores || undefined,
    xeCores: gpu.xe_cores || undefined,
    baseClockMhz: gpu.base_clock_mhz,
    boostClockMhz: gpu.boost_clock_mhz,
    tdpWatts: gpu.tdp_watts,
    releaseDate: gpu.release_date,
    msrpUsd: gpu.msrp_usd,
    imageUrl: gpu.image_url || undefined,
    valueScore,
    lowestNewPrice: lowestNewPrice !== Infinity ? lowestNewPrice : undefined,
    lowestUsedPrice: lowestUsedPrice !== Infinity ? lowestUsedPrice : undefined,
    benchmarks: benchmarks ? {
      gpuId: gpu.id,
      sd15ImgsPerMin: benchmarks.sd15_imgs_per_min || undefined,
      sdxlImgsPerMin: benchmarks.sdxl_imgs_per_min || undefined,
      fluxImgsPerMin: benchmarks.flux_imgs_per_min || undefined,
      llm7bTokensPerSec: benchmarks.llm7b_tokens_per_sec || undefined,
      llm13bTokensPerSec: benchmarks.llm13b_tokens_per_sec || undefined,
      llm70bTokensPerSec: benchmarks.llm70b_tokens_per_sec || undefined,
      maxModelSizeBillions: benchmarks.max_model_size_billions || undefined,
      benchmarkSource: benchmarks.benchmark_source || undefined,
      benchmarkDate: benchmarks.benchmark_date || undefined,
    } : undefined,
    prices: prices.map(p => ({
      gpuId: gpu.id,
      retailer: p.retailer as 'amazon' | 'newegg' | 'ebay' | 'bhphoto' | 'bestbuy' | 'nvidia' | 'microcenter',
      condition: p.condition,
      priceUsd: p.price_usd,
      url: p.url,
      affiliateUrl: p.affiliate_url || undefined,
      inStock: p.in_stock,
      fetchedAt: p.fetched_at,
    })),
  };
}

// Fetch all GPUs with their data
export async function getAllGPUs(): Promise<GPUWithData[]> {
  if (!supabase) {
    // Fallback to sample data if Supabase not configured
    const { sampleGPUs } = await import('./sampleData');
    return sampleGPUs;
  }

  try {
    // Fetch GPUs
    const { data: gpus, error: gpusError } = await supabase
      .from('gpus')
      .select('*')
      .order('name');

    if (gpusError) throw gpusError;
    if (!gpus || gpus.length === 0) {
      // No data in database, use sample data
      const { sampleGPUs } = await import('./sampleData');
      return sampleGPUs;
    }

    // Fetch benchmarks
    const { data: benchmarks, error: benchmarksError } = await supabase
      .from('ai_benchmarks')
      .select('*');

    if (benchmarksError) throw benchmarksError;

    // Fetch prices
    const { data: prices, error: pricesError } = await supabase
      .from('prices')
      .select('*');

    if (pricesError) throw pricesError;

    // Transform to application format
    const benchmarksMap = new Map(benchmarks?.map(b => [b.gpu_id, b]) || []);
    const pricesMap = new Map<string, DBPrice[]>();
    prices?.forEach(p => {
      const existing = pricesMap.get(p.gpu_id) || [];
      existing.push(p);
      pricesMap.set(p.gpu_id, existing);
    });

    return gpus.map(gpu => transformGpu(
      gpu,
      benchmarksMap.get(gpu.id) || null,
      pricesMap.get(gpu.id) || []
    ));
  } catch (error) {
    console.error('Error fetching GPUs from Supabase:', error);
    // Fallback to sample data on error
    const { sampleGPUs } = await import('./sampleData');
    return sampleGPUs;
  }
}

// Fetch a single GPU by slug
export async function getGPUBySlug(slug: string): Promise<GPUWithData | null> {
  if (!supabase) {
    const { sampleGPUs } = await import('./sampleData');
    return sampleGPUs.find(g => g.slug === slug) || null;
  }

  try {
    const { data: gpu, error: gpuError } = await supabase
      .from('gpus')
      .select('*')
      .eq('slug', slug)
      .single();

    if (gpuError || !gpu) {
      // Try sample data as fallback
      const { sampleGPUs } = await import('./sampleData');
      return sampleGPUs.find(g => g.slug === slug) || null;
    }

    // Fetch benchmark
    const { data: benchmark } = await supabase
      .from('ai_benchmarks')
      .select('*')
      .eq('gpu_id', gpu.id)
      .single();

    // Fetch prices
    const { data: prices } = await supabase
      .from('prices')
      .select('*')
      .eq('gpu_id', gpu.id);

    return transformGpu(gpu, benchmark || null, prices || []);
  } catch (error) {
    console.error('Error fetching GPU by slug:', error);
    const { sampleGPUs } = await import('./sampleData');
    return sampleGPUs.find(g => g.slug === slug) || null;
  }
}

// Get all GPU slugs (for static path generation)
export async function getAllGPUSlugs(): Promise<string[]> {
  if (!supabase) {
    const { sampleGPUs } = await import('./sampleData');
    return sampleGPUs.map(g => g.slug);
  }

  try {
    const { data, error } = await supabase
      .from('gpus')
      .select('slug');

    if (error || !data || data.length === 0) {
      const { sampleGPUs } = await import('./sampleData');
      return sampleGPUs.map(g => g.slug);
    }

    return data.map(g => g.slug);
  } catch (error) {
    console.error('Error fetching GPU slugs:', error);
    const { sampleGPUs } = await import('./sampleData');
    return sampleGPUs.map(g => g.slug);
  }
}

// Get price history for a GPU
export async function getPriceHistory(gpuId: string, days: number = 30): Promise<{
  date: string;
  price: number;
  retailer: string;
  condition: string;
}[]> {
  if (!supabase) return [];

  try {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await supabase
      .from('price_history')
      .select('recorded_at, price_usd, retailer, condition')
      .eq('gpu_id', gpuId)
      .gte('recorded_at', since.toISOString())
      .order('recorded_at', { ascending: true });

    if (error) throw error;

    return (data || []).map(p => ({
      date: p.recorded_at,
      price: p.price_usd,
      retailer: p.retailer,
      condition: p.condition,
    }));
  } catch (error) {
    console.error('Error fetching price history:', error);
    return [];
  }
}
