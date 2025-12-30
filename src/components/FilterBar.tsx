import { useState, useCallback } from 'react';
import type { FilterState } from '../types';

interface FilterBarProps {
  initialFilters?: Partial<FilterState>;
  onFilterChange: (filters: FilterState) => void;
  maxPrice?: number;
}

const DEFAULT_FILTERS: FilterState = {
  vramMin: undefined,
  vramMax: undefined,
  priceMin: undefined,
  priceMax: undefined,
  brands: [],
  sortBy: 'value',
  condition: 'all',
};

const VRAM_OPTIONS = [8, 12, 16, 24, 48];
const BRAND_OPTIONS: ('NVIDIA' | 'AMD' | 'Intel')[] = ['NVIDIA', 'AMD', 'Intel'];
const SORT_OPTIONS = [
  { value: 'value', label: 'Best Value' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'vram', label: 'VRAM' },
  { value: 'performance', label: 'Performance' },
] as const;

export default function FilterBar({
  initialFilters = {},
  onFilterChange,
  maxPrice = 3000,
}: FilterBarProps) {
  const [filters, setFilters] = useState<FilterState>({
    ...DEFAULT_FILTERS,
    ...initialFilters,
  });
  const [isExpanded, setIsExpanded] = useState(false);

  const updateFilters = useCallback(
    (updates: Partial<FilterState>) => {
      const newFilters = { ...filters, ...updates };
      setFilters(newFilters);
      onFilterChange(newFilters);
    },
    [filters, onFilterChange]
  );

  const toggleBrand = (brand: 'NVIDIA' | 'AMD' | 'Intel') => {
    const newBrands = filters.brands.includes(brand)
      ? filters.brands.filter((b) => b !== brand)
      : [...filters.brands, brand];
    updateFilters({ brands: newBrands });
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    onFilterChange(DEFAULT_FILTERS);
  };

  const hasActiveFilters =
    filters.vramMin !== undefined ||
    filters.priceMin !== undefined ||
    filters.priceMax !== undefined ||
    filters.brands.length > 0 ||
    filters.condition !== 'all';

  return (
    <div className="filter-bar">
      {/* Mobile filter toggle */}
      <button
        className="filter-bar__toggle"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-controls="filter-content"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        Filters
        {hasActiveFilters && <span className="filter-bar__badge">{filters.brands.length + (filters.vramMin ? 1 : 0) + (filters.condition !== 'all' ? 1 : 0)}</span>}
      </button>

      {/* Filter content */}
      <div
        id="filter-content"
        className={`filter-bar__content ${isExpanded ? 'filter-bar__content--expanded' : ''}`}
      >
        {/* Sort */}
        <div className="filter-bar__group">
          <label htmlFor="sort-select" className="filter-bar__label">
            Sort by
          </label>
          <select
            id="sort-select"
            className="filter-bar__select"
            value={filters.sortBy}
            onChange={(e) => updateFilters({ sortBy: e.target.value as FilterState['sortBy'] })}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* VRAM */}
        <div className="filter-bar__group">
          <label className="filter-bar__label">VRAM</label>
          <div className="filter-bar__chips">
            {VRAM_OPTIONS.map((vram) => (
              <button
                key={vram}
                className={`filter-bar__chip ${filters.vramMin === vram ? 'filter-bar__chip--active' : ''}`}
                onClick={() =>
                  updateFilters({
                    vramMin: filters.vramMin === vram ? undefined : vram,
                  })
                }
                aria-pressed={filters.vramMin === vram}
              >
                {vram}GB+
              </button>
            ))}
          </div>
        </div>

        {/* Brand */}
        <div className="filter-bar__group">
          <label className="filter-bar__label">Brand</label>
          <div className="filter-bar__chips">
            {BRAND_OPTIONS.map((brand) => (
              <button
                key={brand}
                className={`filter-bar__chip filter-bar__chip--${brand.toLowerCase()} ${
                  filters.brands.includes(brand) ? 'filter-bar__chip--active' : ''
                }`}
                onClick={() => toggleBrand(brand)}
                aria-pressed={filters.brands.includes(brand)}
              >
                {brand}
              </button>
            ))}
          </div>
        </div>

        {/* Condition */}
        <div className="filter-bar__group">
          <label className="filter-bar__label">Condition</label>
          <div className="filter-bar__chips">
            {(['all', 'new', 'used'] as const).map((condition) => (
              <button
                key={condition}
                className={`filter-bar__chip ${filters.condition === condition ? 'filter-bar__chip--active' : ''}`}
                onClick={() => updateFilters({ condition })}
                aria-pressed={filters.condition === condition}
              >
                {condition === 'all' ? 'All' : condition.charAt(0).toUpperCase() + condition.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Price Range */}
        <div className="filter-bar__group filter-bar__group--price">
          <label className="filter-bar__label">Price Range</label>
          <div className="filter-bar__range">
            <input
              type="number"
              className="filter-bar__input"
              placeholder="Min"
              value={filters.priceMin || ''}
              onChange={(e) =>
                updateFilters({
                  priceMin: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              min={0}
              max={maxPrice}
            />
            <span className="filter-bar__range-separator">—</span>
            <input
              type="number"
              className="filter-bar__input"
              placeholder="Max"
              value={filters.priceMax || ''}
              onChange={(e) =>
                updateFilters({
                  priceMax: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              min={0}
              max={maxPrice}
            />
          </div>
        </div>

        {/* Reset */}
        {hasActiveFilters && (
          <button className="filter-bar__reset" onClick={resetFilters}>
            Clear all
          </button>
        )}
      </div>

      <style>{`
        .filter-bar {
          background-color: var(--bg-secondary);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-lg);
          padding: var(--spacing-4);
        }

        .filter-bar__toggle {
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
          width: 100%;
          padding: var(--spacing-2) var(--spacing-3);
          background: none;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .filter-bar__toggle:hover {
          border-color: var(--border-strong);
          background-color: var(--bg-tertiary);
        }

        .filter-bar__badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 20px;
          height: 20px;
          padding: 0 6px;
          background-color: var(--brand-primary);
          color: white;
          font-size: 0.75rem;
          font-weight: 600;
          border-radius: var(--radius-full);
          margin-left: auto;
        }

        .filter-bar__content {
          display: none;
          flex-direction: column;
          gap: var(--spacing-4);
          margin-top: var(--spacing-4);
          padding-top: var(--spacing-4);
          border-top: 1px solid var(--border-default);
        }

        .filter-bar__content--expanded {
          display: flex;
        }

        @media (min-width: 768px) {
          .filter-bar__toggle {
            display: none;
          }

          .filter-bar__content {
            display: flex;
            flex-direction: row;
            flex-wrap: wrap;
            align-items: flex-end;
            gap: var(--spacing-4);
            margin-top: 0;
            padding-top: 0;
            border-top: none;
          }
        }

        .filter-bar__group {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-2);
        }

        .filter-bar__group--price {
          min-width: 180px;
        }

        .filter-bar__label {
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.025em;
        }

        .filter-bar__select {
          padding: var(--spacing-2) var(--spacing-3);
          background-color: var(--bg-primary);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-size: 0.875rem;
          cursor: pointer;
          min-width: 150px;
        }

        .filter-bar__select:focus {
          outline: none;
          border-color: var(--brand-primary);
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--brand-primary) 20%, transparent);
        }

        .filter-bar__chips {
          display: flex;
          flex-wrap: wrap;
          gap: var(--spacing-2);
        }

        .filter-bar__chip {
          padding: var(--spacing-1) var(--spacing-3);
          background-color: var(--bg-primary);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-full);
          color: var(--text-secondary);
          font-size: 0.8125rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .filter-bar__chip:hover {
          border-color: var(--border-strong);
          background-color: var(--bg-tertiary);
        }

        .filter-bar__chip--active {
          background-color: var(--brand-primary);
          border-color: var(--brand-primary);
          color: white;
        }

        .filter-bar__chip--active:hover {
          background-color: var(--brand-hover);
          border-color: var(--brand-hover);
        }

        .filter-bar__chip--nvidia.filter-bar__chip--active {
          background-color: var(--color-gpu-nvidia);
          border-color: var(--color-gpu-nvidia);
        }

        .filter-bar__chip--amd.filter-bar__chip--active {
          background-color: var(--color-gpu-amd);
          border-color: var(--color-gpu-amd);
        }

        .filter-bar__chip--intel.filter-bar__chip--active {
          background-color: var(--color-gpu-intel);
          border-color: var(--color-gpu-intel);
        }

        .filter-bar__range {
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
        }

        .filter-bar__range-separator {
          color: var(--text-muted);
        }

        .filter-bar__input {
          width: 80px;
          padding: var(--spacing-2);
          background-color: var(--bg-primary);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-size: 0.875rem;
          font-family: var(--font-mono);
        }

        .filter-bar__input:focus {
          outline: none;
          border-color: var(--brand-primary);
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--brand-primary) 20%, transparent);
        }

        .filter-bar__input::placeholder {
          color: var(--text-muted);
        }

        .filter-bar__reset {
          padding: var(--spacing-2) var(--spacing-3);
          background: none;
          border: none;
          color: var(--text-muted);
          font-size: 0.875rem;
          cursor: pointer;
          transition: color 0.15s ease;
        }

        .filter-bar__reset:hover {
          color: var(--text-primary);
        }

        @media (min-width: 768px) {
          .filter-bar__reset {
            margin-left: auto;
          }
        }
      `}</style>
    </div>
  );
}
