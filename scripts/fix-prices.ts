import { createClient } from '@supabase/supabase-js';
import { sampleGPUs } from '../src/lib/sampleData.ts';
import { config } from 'dotenv';

// Load .env file
config();

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixPrices() {
  console.log('Fixing prices in Supabase...\n');

  // First, get all GPUs from Supabase to get their UUIDs
  const { data: dbGPUs, error: fetchError } = await supabase
    .from('gpus')
    .select('id, slug');

  if (fetchError) {
    console.error('Error fetching GPUs:', fetchError);
    process.exit(1);
  }

  // Create a map of slug -> UUID
  const slugToId = new Map<string, string>();
  for (const gpu of dbGPUs || []) {
    slugToId.set(gpu.slug, gpu.id);
  }

  console.log(`Found ${slugToId.size} GPUs in database\n`);

  // Delete all existing prices (they're empty/broken anyway)
  const { error: deleteError } = await supabase
    .from('prices')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

  if (deleteError) {
    console.error('Error deleting existing prices:', deleteError);
  } else {
    console.log('Cleared existing prices\n');
  }

  // Insert prices for each GPU
  let successCount = 0;
  let errorCount = 0;

  for (const gpu of sampleGPUs) {
    const gpuId = slugToId.get(gpu.slug);

    if (!gpuId) {
      console.log(`Skipping ${gpu.name} - not found in database`);
      continue;
    }

    if (!gpu.prices || gpu.prices.length === 0) {
      console.log(`Skipping ${gpu.name} - no prices in sample data`);
      continue;
    }

    for (const price of gpu.prices) {
      const priceData = {
        gpu_id: gpuId,
        retailer: price.retailer,
        price_usd: price.priceUsd,
        url: price.url,
        condition: price.condition || 'new',
        in_stock: price.inStock ?? true,
        fetched_at: new Date().toISOString(),
      };

      const { error: insertError } = await supabase
        .from('prices')
        .insert(priceData);

      if (insertError) {
        console.error(`Error inserting price for ${gpu.name} at ${price.retailer}:`, insertError.message);
        errorCount++;
      } else {
        successCount++;
      }
    }
  }

  console.log(`\nDone! Inserted ${successCount} prices, ${errorCount} errors`);
}

fixPrices().catch(console.error);
