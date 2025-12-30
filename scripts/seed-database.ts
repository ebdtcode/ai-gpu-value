/**
 * Database Seed Script
 *
 * Run this script to migrate data from sampleData.ts to Supabase.
 *
 * Usage:
 *   npx tsx scripts/seed-database.ts
 *
 * Prerequisites:
 *   1. Create tables by running supabase/migrations/001_initial_schema.sql in Supabase SQL Editor
 *   2. Set environment variables in .env:
 *      - PUBLIC_SUPABASE_URL
 *      - PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY for write access)
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Set PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Import sample data
import { sampleGPUs } from '../src/lib/sampleData.js';

async function seedDatabase() {
  console.log('Starting database seed...');
  console.log(`Found ${sampleGPUs.length} GPUs to migrate`);

  let successCount = 0;
  let errorCount = 0;

  for (const gpu of sampleGPUs) {
    try {
      // Insert GPU
      const { data: insertedGpu, error: gpuError } = await supabase
        .from('gpus')
        .upsert({
          slug: gpu.slug,
          name: gpu.name,
          brand: gpu.brand,
          model: gpu.model,
          architecture: gpu.architecture,
          vram_gb: gpu.vramGb,
          vram_type: gpu.vramType,
          memory_bandwidth_gbps: gpu.memoryBandwidthGbps,
          cuda_cores: gpu.cudaCores || null,
          stream_processors: gpu.streamProcessors || null,
          tensor_cores: gpu.tensorCores || null,
          xe_cores: gpu.xeCores || null,
          base_clock_mhz: gpu.baseClockMhz,
          boost_clock_mhz: gpu.boostClockMhz,
          tdp_watts: gpu.tdpWatts,
          release_date: gpu.releaseDate,
          msrp_usd: gpu.msrpUsd,
          image_url: gpu.imageUrl || null,
        }, {
          onConflict: 'slug',
        })
        .select()
        .single();

      if (gpuError) {
        console.error(`Error inserting GPU ${gpu.name}:`, gpuError.message);
        errorCount++;
        continue;
      }

      const gpuId = insertedGpu.id;

      // Insert benchmarks if available
      if (gpu.benchmarks) {
        const { error: benchmarkError } = await supabase
          .from('ai_benchmarks')
          .upsert({
            gpu_id: gpuId,
            sd15_imgs_per_min: gpu.benchmarks.sd15ImgsPerMin || null,
            sdxl_imgs_per_min: gpu.benchmarks.sdxlImgsPerMin || null,
            flux_imgs_per_min: gpu.benchmarks.fluxImgsPerMin || null,
            llm7b_tokens_per_sec: gpu.benchmarks.llm7bTokensPerSec || null,
            llm13b_tokens_per_sec: gpu.benchmarks.llm13bTokensPerSec || null,
            llm70b_tokens_per_sec: gpu.benchmarks.llm70bTokensPerSec || null,
            max_model_size_billions: gpu.benchmarks.maxModelSizeBillions || null,
            benchmark_source: gpu.benchmarks.benchmarkSource || null,
            benchmark_date: gpu.benchmarks.benchmarkDate || null,
          }, {
            onConflict: 'gpu_id',
          });

        if (benchmarkError) {
          console.error(`Error inserting benchmarks for ${gpu.name}:`, benchmarkError.message);
        }
      }

      // Insert prices if available
      if (gpu.prices && gpu.prices.length > 0) {
        for (const price of gpu.prices) {
          const { error: priceError } = await supabase
            .from('prices')
            .upsert({
              gpu_id: gpuId,
              retailer: price.retailer,
              condition: price.condition,
              price_usd: price.priceUsd,
              url: price.url,
              affiliate_url: price.affiliateUrl || null,
              in_stock: price.inStock,
              fetched_at: price.fetchedAt || new Date().toISOString(),
            }, {
              onConflict: 'gpu_id,retailer,condition',
              ignoreDuplicates: false,
            });

          if (priceError) {
            console.error(`Error inserting price for ${gpu.name}:`, priceError.message);
          }
        }
      }

      console.log(`✓ Migrated: ${gpu.name}`);
      successCount++;
    } catch (error) {
      console.error(`Error processing ${gpu.name}:`, error);
      errorCount++;
    }
  }

  console.log('\n--- Migration Complete ---');
  console.log(`Successfully migrated: ${successCount} GPUs`);
  console.log(`Errors: ${errorCount}`);
}

seedDatabase().catch(console.error);
