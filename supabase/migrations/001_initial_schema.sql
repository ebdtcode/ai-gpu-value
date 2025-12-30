-- AIGPUValue Database Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================
-- GPUS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS gpus (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  brand TEXT NOT NULL CHECK (brand IN ('NVIDIA', 'AMD', 'Intel')),
  model TEXT NOT NULL,
  architecture TEXT NOT NULL,
  vram_gb INTEGER NOT NULL,
  vram_type TEXT NOT NULL,
  memory_bandwidth_gbps INTEGER NOT NULL,
  cuda_cores INTEGER,
  stream_processors INTEGER,
  tensor_cores INTEGER,
  xe_cores INTEGER,
  base_clock_mhz INTEGER NOT NULL,
  boost_clock_mhz INTEGER NOT NULL,
  tdp_watts INTEGER NOT NULL,
  release_date DATE NOT NULL,
  msrp_usd DECIMAL(10,2) NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- AI BENCHMARKS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS ai_benchmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gpu_id UUID NOT NULL REFERENCES gpus(id) ON DELETE CASCADE,
  sd15_imgs_per_min DECIMAL(10,2),
  sdxl_imgs_per_min DECIMAL(10,2),
  flux_imgs_per_min DECIMAL(10,2),
  llm7b_tokens_per_sec INTEGER,
  llm13b_tokens_per_sec INTEGER,
  llm70b_tokens_per_sec INTEGER,
  max_model_size_billions INTEGER,
  benchmark_source TEXT,
  benchmark_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(gpu_id)
);

-- =====================
-- PRICES TABLE
-- =====================
CREATE TABLE IF NOT EXISTS prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gpu_id UUID NOT NULL REFERENCES gpus(id) ON DELETE CASCADE,
  retailer TEXT NOT NULL CHECK (retailer IN ('amazon', 'newegg', 'ebay', 'bhphoto', 'bestbuy', 'nvidia', 'microcenter')),
  condition TEXT NOT NULL CHECK (condition IN ('new', 'used', 'refurbished', 'open-box')),
  price_usd DECIMAL(10,2) NOT NULL,
  url TEXT NOT NULL,
  affiliate_url TEXT,
  in_stock BOOLEAN DEFAULT true,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- PRICE HISTORY TABLE (for tracking over time)
-- =====================
CREATE TABLE IF NOT EXISTS price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gpu_id UUID NOT NULL REFERENCES gpus(id) ON DELETE CASCADE,
  retailer TEXT NOT NULL,
  condition TEXT NOT NULL,
  price_usd DECIMAL(10,2) NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- INDEXES
-- =====================
CREATE INDEX IF NOT EXISTS idx_gpus_slug ON gpus(slug);
CREATE INDEX IF NOT EXISTS idx_gpus_brand ON gpus(brand);
CREATE INDEX IF NOT EXISTS idx_gpus_vram ON gpus(vram_gb);
CREATE INDEX IF NOT EXISTS idx_benchmarks_gpu_id ON ai_benchmarks(gpu_id);
CREATE INDEX IF NOT EXISTS idx_prices_gpu_id ON prices(gpu_id);
CREATE INDEX IF NOT EXISTS idx_prices_retailer ON prices(retailer);
CREATE INDEX IF NOT EXISTS idx_prices_condition ON prices(condition);
CREATE INDEX IF NOT EXISTS idx_price_history_gpu_id ON price_history(gpu_id);
CREATE INDEX IF NOT EXISTS idx_price_history_recorded_at ON price_history(recorded_at);

-- =====================
-- ROW LEVEL SECURITY
-- =====================
ALTER TABLE gpus ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

-- Public read access for all tables
CREATE POLICY "Allow public read access on gpus" ON gpus
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access on ai_benchmarks" ON ai_benchmarks
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access on prices" ON prices
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access on price_history" ON price_history
  FOR SELECT USING (true);

-- =====================
-- VIEWS FOR COMMON QUERIES
-- =====================

-- GPU with latest prices and benchmarks
CREATE OR REPLACE VIEW gpus_with_data AS
SELECT
  g.*,
  b.sd15_imgs_per_min,
  b.sdxl_imgs_per_min,
  b.flux_imgs_per_min,
  b.llm7b_tokens_per_sec,
  b.llm13b_tokens_per_sec,
  b.llm70b_tokens_per_sec,
  b.max_model_size_billions,
  b.benchmark_source,
  b.benchmark_date,
  (
    SELECT MIN(price_usd)
    FROM prices p
    WHERE p.gpu_id = g.id AND p.condition = 'new' AND p.in_stock = true
  ) as lowest_new_price,
  (
    SELECT MIN(price_usd)
    FROM prices p
    WHERE p.gpu_id = g.id AND p.condition = 'used' AND p.in_stock = true
  ) as lowest_used_price,
  -- Calculate value score (simplified version)
  CASE
    WHEN (SELECT MIN(price_usd) FROM prices p WHERE p.gpu_id = g.id AND p.in_stock = true) IS NULL THEN 0
    ELSE LEAST(100, GREATEST(0,
      (COALESCE(b.sdxl_imgs_per_min, 0) * 4 +
       COALESCE(b.llm7b_tokens_per_sec, 0) * 0.3 +
       g.vram_gb * 2) * 100 /
      NULLIF((SELECT MIN(price_usd) FROM prices p WHERE p.gpu_id = g.id AND p.in_stock = true), 0)
    ))::INTEGER
  END as value_score
FROM gpus g
LEFT JOIN ai_benchmarks b ON b.gpu_id = g.id;

-- =====================
-- FUNCTIONS
-- =====================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_gpus_updated_at
  BEFORE UPDATE ON gpus
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_benchmarks_updated_at
  BEFORE UPDATE ON ai_benchmarks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to record price history on price insert/update
CREATE OR REPLACE FUNCTION record_price_history()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO price_history (gpu_id, retailer, condition, price_usd)
  VALUES (NEW.gpu_id, NEW.retailer, NEW.condition, NEW.price_usd);
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER record_price_on_insert
  AFTER INSERT ON prices
  FOR EACH ROW
  EXECUTE FUNCTION record_price_history();

CREATE TRIGGER record_price_on_update
  AFTER UPDATE OF price_usd ON prices
  FOR EACH ROW
  WHEN (OLD.price_usd IS DISTINCT FROM NEW.price_usd)
  EXECUTE FUNCTION record_price_history();
