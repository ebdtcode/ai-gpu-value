export type Retailer = 'amazon' | 'newegg' | 'ebay' | 'bhphoto' | 'bestbuy' | 'nvidia' | 'microcenter';
export type Condition = 'new' | 'used' | 'refurbished' | 'open-box';

/** One row of data/gpus.json (only the fields the fetchers need). */
export interface CatalogGpu {
  slug: string;
  name: string;
  model: string;
  msrpUsd: number;
}

/** One row of data/prices.json. */
export interface PriceRecord {
  slug: string;
  retailer: Retailer;
  condition: Condition;
  priceUsd: number;
  url: string;
  inStock: boolean;
  fetchedAt: string;
  productName?: string;
}

/** A listing a source found and matched to a catalog slug. */
export interface Listing {
  slug: string;
  retailer: Retailer;
  condition: Condition;
  priceUsd: number;
  url: string;
  inStock: boolean;
  productName: string;
}

export interface SourceResult {
  retailer: Retailer;
  listings: Listing[];
  pagesFetched: number;
  errors: string[];
}

export interface Source {
  retailer: Retailer;
  run(catalog: CatalogGpu[]): Promise<SourceResult>;
}
