import { useState, useMemo, useCallback } from 'react';
import type { FilterState, GPUWithData } from '../types';
import { getValueRating, formatPrice, formatNumber } from '../types';
import FilterBar from './FilterBar';

interface GPUListProps {
  gpus: GPUWithData[];
  initialView?: 'table' | 'cards';
}

function applyFilters(gpus: GPUWithData[], filters: FilterState): GPUWithData[] {
  return gpus.filter((gpu) => {
    // VRAM filter
    if (filters.vramMin && gpu.vramGb < filters.vramMin) return false;
    if (filters.vramMax && gpu.vramGb > filters.vramMax) return false;

    // Brand filter
    if (filters.brands.length > 0 && !filters.brands.includes(gpu.brand)) return false;

    // Price filter
    const price = filters.condition === 'used' ? gpu.lowestUsedPrice : gpu.lowestNewPrice;
    if (filters.priceMin && (!price || price < filters.priceMin)) return false;
    if (filters.priceMax && (!price || price > filters.priceMax)) return false;

    // Condition filter
    if (filters.condition === 'new' && !gpu.lowestNewPrice) return false;
    if (filters.condition === 'used' && !gpu.lowestUsedPrice) return false;

    return true;
  });
}

function sortGPUs(gpus: GPUWithData[], sortBy: FilterState['sortBy'], condition: FilterState['condition']): GPUWithData[] {
  return [...gpus].sort((a, b) => {
    const getPrice = (gpu: GPUWithData) =>
      condition === 'used'
        ? gpu.lowestUsedPrice || gpu.lowestNewPrice || gpu.msrpUsd
        : gpu.lowestNewPrice || gpu.lowestUsedPrice || gpu.msrpUsd;

    switch (sortBy) {
      case 'value':
        return b.valueScore - a.valueScore;
      case 'price-asc':
        return (getPrice(a) || 0) - (getPrice(b) || 0);
      case 'price-desc':
        return (getPrice(b) || 0) - (getPrice(a) || 0);
      case 'vram':
        return b.vramGb - a.vramGb;
      case 'performance':
        return (b.benchmarks?.sdxlImgsPerMin || 0) - (a.benchmarks?.sdxlImgsPerMin || 0);
      default:
        return b.valueScore - a.valueScore;
    }
  });
}

export default function GPUList({ gpus, initialView = 'table' }: GPUListProps) {
  const [filters, setFilters] = useState<FilterState>({
    brands: [],
    sortBy: 'value',
    condition: 'all',
  });
  const [view, setView] = useState<'table' | 'cards'>(initialView);

  const handleFilterChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
  }, []);

  const filteredGPUs = useMemo(() => {
    const filtered = applyFilters(gpus, filters);
    return sortGPUs(filtered, filters.sortBy, filters.condition);
  }, [gpus, filters]);

  const getDisplayPrice = (gpu: GPUWithData) => {
    if (filters.condition === 'used') {
      return gpu.lowestUsedPrice || gpu.lowestNewPrice;
    }
    return gpu.lowestNewPrice || gpu.lowestUsedPrice;
  };

  return (
    <div className="gpu-list">
      <div className="gpu-list__controls">
        <FilterBar onFilterChange={handleFilterChange} />

        <div className="gpu-list__view-toggle">
          <button
            className={`view-btn ${view === 'table' ? 'view-btn--active' : ''}`}
            onClick={() => setView('table')}
            aria-pressed={view === 'table'}
            aria-label="Table view"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
          </button>
          <button
            className={`view-btn ${view === 'cards' ? 'view-btn--active' : ''}`}
            onClick={() => setView('cards')}
            aria-pressed={view === 'cards'}
            aria-label="Card view"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <div className="gpu-list__results">
        <span className="gpu-list__count">
          {filteredGPUs.length} GPU{filteredGPUs.length !== 1 ? 's' : ''} found
        </span>
      </div>

      {filteredGPUs.length === 0 ? (
        <div className="gpu-list__empty">
          <p>No GPUs match your filters. Try adjusting your criteria.</p>
        </div>
      ) : view === 'table' ? (
        <div className="gpu-table-wrapper">
          <table className="gpu-table">
            <thead>
              <tr>
                <th className="gpu-table__th--sticky">GPU</th>
                <th>Value</th>
                <th>VRAM</th>
                <th>SDXL</th>
                <th>LLM 7B</th>
                <th>Price</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredGPUs.map((gpu) => (
                <tr key={gpu.id} className="gpu-table__row">
                  <td className="gpu-table__td--gpu">
                    <a href={`/gpus/${gpu.slug}`} className="gpu-table__link">
                      <span className={`gpu-brand gpu-brand--${gpu.brand.toLowerCase()}`}>
                        {gpu.brand}
                      </span>
                      <span className="gpu-table__name">{gpu.model}</span>
                    </a>
                  </td>
                  <td>
                    <span className={`value-badge value-badge--${getValueRating(gpu.valueScore)}`}>
                      {gpu.valueScore}
                    </span>
                  </td>
                  <td className="gpu-table__td--spec">{gpu.vramGb}GB</td>
                  <td className="gpu-table__td--spec">
                    {gpu.benchmarks?.sdxlImgsPerMin ? `${gpu.benchmarks.sdxlImgsPerMin}/min` : '—'}
                  </td>
                  <td className="gpu-table__td--spec">
                    {gpu.benchmarks?.llm7bTokensPerSec ? `${gpu.benchmarks.llm7bTokensPerSec} t/s` : '—'}
                  </td>
                  <td className="gpu-table__td--price">
                    {getDisplayPrice(gpu) ? (
                      <span className="price">{formatPrice(getDisplayPrice(gpu)!)}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <a
                      href={gpu.prices[0]?.affiliateUrl || `/gpus/${gpu.slug}`}
                      className="btn btn--sm btn--primary"
                      target={gpu.prices[0]?.affiliateUrl ? '_blank' : undefined}
                      rel={gpu.prices[0]?.affiliateUrl ? 'noopener sponsored' : undefined}
                    >
                      View
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="gpu-cards">
          {filteredGPUs.map((gpu) => (
            <article key={gpu.id} className="gpu-card">
              <div className="gpu-card__header">
                <span className={`gpu-brand gpu-brand--${gpu.brand.toLowerCase()}`}>
                  {gpu.brand}
                </span>
                <span className={`value-badge value-badge--${getValueRating(gpu.valueScore)}`}>
                  {gpu.valueScore}
                </span>
              </div>
              <h3 className="gpu-card__title">
                <a href={`/gpus/${gpu.slug}`}>{gpu.name}</a>
              </h3>
              <div className="gpu-card__specs">
                <div className="gpu-card__spec">
                  <span className="gpu-card__spec-label">VRAM</span>
                  <span className="gpu-card__spec-value">{gpu.vramGb}GB {gpu.vramType}</span>
                </div>
                <div className="gpu-card__spec">
                  <span className="gpu-card__spec-label">SDXL</span>
                  <span className="gpu-card__spec-value">
                    {gpu.benchmarks?.sdxlImgsPerMin ? `${gpu.benchmarks.sdxlImgsPerMin} img/min` : '—'}
                  </span>
                </div>
                <div className="gpu-card__spec">
                  <span className="gpu-card__spec-label">LLM 7B</span>
                  <span className="gpu-card__spec-value">
                    {gpu.benchmarks?.llm7bTokensPerSec ? `${gpu.benchmarks.llm7bTokensPerSec} tok/s` : '—'}
                  </span>
                </div>
                <div className="gpu-card__spec">
                  <span className="gpu-card__spec-label">TDP</span>
                  <span className="gpu-card__spec-value">{gpu.tdpWatts}W</span>
                </div>
              </div>
              <div className="gpu-card__footer">
                <div className="gpu-card__price">
                  {getDisplayPrice(gpu) ? (
                    <>
                      <span className="gpu-card__price-current">{formatPrice(getDisplayPrice(gpu)!)}</span>
                      {filters.condition !== 'used' && gpu.lowestUsedPrice && (
                        <span className="gpu-card__price-used">Used: {formatPrice(gpu.lowestUsedPrice)}</span>
                      )}
                    </>
                  ) : (
                    <span className="gpu-card__price-na">Price unavailable</span>
                  )}
                </div>
                <a
                  href={gpu.prices[0]?.affiliateUrl || `/gpus/${gpu.slug}`}
                  className="btn btn--primary"
                  target={gpu.prices[0]?.affiliateUrl ? '_blank' : undefined}
                  rel={gpu.prices[0]?.affiliateUrl ? 'noopener sponsored' : undefined}
                >
                  Check Price
                </a>
              </div>
            </article>
          ))}
        </div>
      )}

      <style>{`
        .gpu-list__controls {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-4);
          margin-bottom: var(--spacing-4);
        }

        @media (min-width: 768px) {
          .gpu-list__controls {
            flex-direction: row;
            align-items: flex-start;
            justify-content: space-between;
          }
        }

        .gpu-list__view-toggle {
          display: flex;
          gap: var(--spacing-1);
          background-color: var(--bg-secondary);
          padding: var(--spacing-1);
          border-radius: var(--radius-md);
          border: 1px solid var(--border-default);
        }

        .view-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--spacing-2);
          background: none;
          border: none;
          border-radius: var(--radius-sm);
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .view-btn:hover {
          color: var(--text-primary);
          background-color: var(--bg-tertiary);
        }

        .view-btn--active {
          color: var(--brand-primary);
          background-color: color-mix(in srgb, var(--brand-primary) 10%, transparent);
        }

        .gpu-list__results {
          margin-bottom: var(--spacing-4);
        }

        .gpu-list__count {
          font-size: 0.875rem;
          color: var(--text-muted);
        }

        .gpu-list__empty {
          text-align: center;
          padding: var(--spacing-12) var(--spacing-4);
          background-color: var(--bg-secondary);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-lg);
          color: var(--text-muted);
        }

        /* Table Styles */
        .gpu-table-wrapper {
          overflow-x: auto;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-lg);
          background-color: var(--bg-secondary);
        }

        .gpu-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.875rem;
        }

        .gpu-table th {
          padding: var(--spacing-3) var(--spacing-4);
          text-align: left;
          font-weight: 600;
          color: var(--text-muted);
          background-color: var(--bg-tertiary);
          border-bottom: 1px solid var(--border-default);
          white-space: nowrap;
        }

        .gpu-table__th--sticky {
          position: sticky;
          left: 0;
          z-index: 1;
          background-color: var(--bg-tertiary);
          min-width: 200px;
        }

        .gpu-table__row {
          transition: background-color 0.15s ease;
        }

        .gpu-table__row:hover {
          background-color: var(--bg-tertiary);
        }

        .gpu-table td {
          padding: var(--spacing-3) var(--spacing-4);
          border-bottom: 1px solid var(--border-default);
          white-space: nowrap;
        }

        .gpu-table__td--gpu {
          position: sticky;
          left: 0;
          background-color: var(--bg-secondary);
          z-index: 1;
        }

        .gpu-table__row:hover .gpu-table__td--gpu {
          background-color: var(--bg-tertiary);
        }

        .gpu-table__link {
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
          text-decoration: none;
          color: inherit;
        }

        .gpu-table__name {
          color: var(--text-primary);
          font-weight: 500;
        }

        .gpu-table__td--spec {
          color: var(--text-secondary);
          font-family: var(--font-mono);
          font-size: 0.8125rem;
        }

        .gpu-table__td--price .price {
          color: var(--text-primary);
          font-weight: 600;
        }

        /* Card Styles */
        .gpu-cards {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: var(--spacing-4);
        }

        .gpu-card {
          background-color: var(--bg-secondary);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-lg);
          padding: var(--spacing-4);
          transition: all 0.2s ease;
        }

        .gpu-card:hover {
          border-color: var(--brand-primary);
          box-shadow: 0 4px 12px color-mix(in srgb, var(--brand-primary) 10%, transparent);
        }

        .gpu-card__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--spacing-2);
        }

        .gpu-card__title {
          font-size: 1.125rem;
          font-weight: 600;
          margin: 0 0 var(--spacing-3);
        }

        .gpu-card__title a {
          color: var(--text-primary);
          text-decoration: none;
        }

        .gpu-card__title a:hover {
          color: var(--brand-primary);
        }

        .gpu-card__specs {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: var(--spacing-2);
          margin-bottom: var(--spacing-4);
        }

        .gpu-card__spec {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .gpu-card__spec-label {
          font-size: 0.6875rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .gpu-card__spec-value {
          font-size: 0.875rem;
          color: var(--text-primary);
          font-weight: 500;
        }

        .gpu-card__footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: var(--spacing-3);
          border-top: 1px solid var(--border-default);
        }

        .gpu-card__price {
          display: flex;
          flex-direction: column;
        }

        .gpu-card__price-current {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .gpu-card__price-used {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .gpu-card__price-na {
          font-size: 0.875rem;
          color: var(--text-muted);
        }

        /* Shared Styles */
        .gpu-brand {
          display: inline-flex;
          padding: 2px 8px;
          border-radius: var(--radius-sm);
          font-size: 0.625rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .gpu-brand--nvidia {
          background-color: color-mix(in srgb, var(--color-gpu-nvidia) 15%, transparent);
          color: var(--color-gpu-nvidia);
        }

        .gpu-brand--amd {
          background-color: color-mix(in srgb, var(--color-gpu-amd) 15%, transparent);
          color: var(--color-gpu-amd);
        }

        .gpu-brand--intel {
          background-color: color-mix(in srgb, var(--color-gpu-intel) 15%, transparent);
          color: var(--color-gpu-intel);
        }

        .value-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 36px;
          padding: 4px 8px;
          border-radius: var(--radius-full);
          font-size: 0.8125rem;
          font-weight: 700;
        }

        .value-badge--excellent {
          background-color: color-mix(in srgb, var(--color-value-excellent) 15%, transparent);
          color: var(--color-value-excellent);
        }

        .value-badge--good {
          background-color: color-mix(in srgb, var(--color-value-good) 15%, transparent);
          color: var(--color-value-good);
        }

        .value-badge--fair {
          background-color: color-mix(in srgb, var(--color-value-fair) 15%, transparent);
          color: var(--color-value-fair);
        }

        .price {
          color: var(--text-primary);
          font-weight: 600;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: var(--spacing-2) var(--spacing-4);
          font-size: 0.875rem;
          font-weight: 500;
          border-radius: var(--radius-md);
          text-decoration: none;
          cursor: pointer;
          transition: all 0.15s ease;
          border: none;
        }

        .btn--primary {
          background-color: var(--brand-primary);
          color: white;
        }

        .btn--primary:hover {
          background-color: var(--brand-hover);
        }

        .btn--sm {
          padding: var(--spacing-1) var(--spacing-3);
          font-size: 0.8125rem;
        }
      `}</style>
    </div>
  );
}
