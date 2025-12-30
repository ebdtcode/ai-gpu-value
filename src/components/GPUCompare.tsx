import { useState, useMemo, useEffect } from 'react';
import type { GPUWithData } from '../types';
import { formatPrice, formatNumber, getValueRating } from '../types';

interface GPUCompareProps {
  allGPUs: GPUWithData[];
  initialSelection?: string[];
}

export default function GPUCompare({ allGPUs = [], initialSelection = [] }: GPUCompareProps) {
  // Ensure allGPUs is an array
  const gpuList = Array.isArray(allGPUs) ? allGPUs : [];

  const [selectedIds, setSelectedIds] = useState<(string | null)[]>([null, null, null, null]);
  const [initialized, setInitialized] = useState(false);

  // Initialize selection after component mounts with props available
  useEffect(() => {
    if (!initialized && gpuList.length > 0) {
      if (initialSelection.length > 0) {
        setSelectedIds([...initialSelection, null, null, null].slice(0, 4));
      } else {
        setSelectedIds([gpuList[0]?.id || null, gpuList[1]?.id || null, gpuList[2]?.id || null, null]);
      }
      setInitialized(true);
    }
  }, [gpuList, initialSelection, initialized]);

  const selectedGPUs = useMemo(() => {
    return selectedIds
      .map(id => id ? gpuList.find(gpu => gpu.id === id) : null)
      .filter((gpu): gpu is GPUWithData => gpu !== null);
  }, [selectedIds, gpuList]);

  const handleSelectChange = (slotIndex: number, gpuId: string) => {
    setSelectedIds(prev => {
      const newSelection = [...prev];
      newSelection[slotIndex] = gpuId || null;
      return newSelection;
    });
  };

  const handleRemove = (slotIndex: number) => {
    setSelectedIds(prev => {
      const newSelection = [...prev];
      newSelection[slotIndex] = null;
      return newSelection;
    });
  };

  const getCompareValue = (
    gpu: GPUWithData,
    getter: (gpu: GPUWithData) => number | undefined,
    higherIsBetter: boolean = true
  ) => {
    const value = getter(gpu);
    if (value === undefined) return { value: undefined, isBest: false };

    const allValues = selectedGPUs
      .map(g => getter(g))
      .filter((v): v is number => v !== undefined);

    const bestValue = higherIsBetter ? Math.max(...allValues) : Math.min(...allValues);
    return { value, isBest: value === bestValue && allValues.length > 1 };
  };

  return (
    <div className="gpu-compare">
      {/* GPU Selector */}
      <div className="gpu-selector">
        <div className="gpu-selector__slots">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="gpu-selector__slot">
              <select
                className="gpu-selector__select"
                value={selectedIds[index] || ''}
                onChange={(e) => handleSelectChange(index, e.target.value)}
                aria-label={`Select GPU ${index + 1}`}
              >
                <option value="">Select GPU {index + 1}</option>
                {gpuList.map((gpu) => (
                  <option key={gpu.id} value={gpu.id}>
                    {gpu.name}
                  </option>
                ))}
              </select>
              {selectedIds[index] && (
                <button
                  className="gpu-selector__remove"
                  onClick={() => handleRemove(index)}
                  aria-label="Remove GPU"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {selectedGPUs.length === 0 ? (
        <div className="gpu-compare__empty">
          <p>Select GPUs above to compare them side-by-side</p>
        </div>
      ) : (
        <div className="comparison-table-wrapper">
          <table className="comparison-table">
            <thead>
              <tr>
                <th className="comparison-table__header comparison-table__header--sticky">Specification</th>
                {selectedGPUs.map((gpu) => (
                  <th key={gpu.id} className="comparison-table__header comparison-table__header--gpu">
                    <span className={`gpu-brand gpu-brand--${gpu.brand.toLowerCase()}`}>{gpu.brand}</span>
                    <span className="comparison-table__gpu-name">{gpu.model}</span>
                    <span className={`value-badge value-badge--${getValueRating(gpu.valueScore)}`}>
                      {gpu.valueScore}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Pricing Section */}
              <tr className="comparison-table__section-header">
                <td colSpan={selectedGPUs.length + 1}>Pricing</td>
              </tr>
              <tr>
                <td className="comparison-table__label">Best Used Price</td>
                {selectedGPUs.map((gpu) => {
                  const { value, isBest } = getCompareValue(gpu, g => g.lowestUsedPrice, false);
                  return (
                    <td key={gpu.id} className={`comparison-table__value ${isBest ? 'comparison-table__value--best' : ''}`}>
                      <span className="price">{value ? formatPrice(value) : '—'}</span>
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="comparison-table__label">Best New Price</td>
                {selectedGPUs.map((gpu) => {
                  const { value, isBest } = getCompareValue(gpu, g => g.lowestNewPrice, false);
                  return (
                    <td key={gpu.id} className={`comparison-table__value ${isBest ? 'comparison-table__value--best' : ''}`}>
                      <span className="price">{value ? formatPrice(value) : '—'}</span>
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="comparison-table__label">MSRP</td>
                {selectedGPUs.map((gpu) => (
                  <td key={gpu.id} className="comparison-table__value">
                    <span className="spec-value">{formatPrice(gpu.msrpUsd)}</span>
                  </td>
                ))}
              </tr>

              {/* AI Performance Section */}
              <tr className="comparison-table__section-header">
                <td colSpan={selectedGPUs.length + 1}>AI Performance</td>
              </tr>
              <tr>
                <td className="comparison-table__label">SDXL (1024x1024)</td>
                {selectedGPUs.map((gpu) => {
                  const { value, isBest } = getCompareValue(gpu, g => g.benchmarks?.sdxlImgsPerMin);
                  return (
                    <td key={gpu.id} className={`comparison-table__value ${isBest ? 'comparison-table__value--best' : ''}`}>
                      <span className="spec-value">{value ? `${value} img/min` : '—'}</span>
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="comparison-table__label">LLM 7B Inference</td>
                {selectedGPUs.map((gpu) => {
                  const { value, isBest } = getCompareValue(gpu, g => g.benchmarks?.llm7bTokensPerSec);
                  return (
                    <td key={gpu.id} className={`comparison-table__value ${isBest ? 'comparison-table__value--best' : ''}`}>
                      <span className="spec-value">{value ? `${value} tok/s` : '—'}</span>
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="comparison-table__label">LLM 13B Inference</td>
                {selectedGPUs.map((gpu) => {
                  const { value, isBest } = getCompareValue(gpu, g => g.benchmarks?.llm13bTokensPerSec);
                  return (
                    <td key={gpu.id} className={`comparison-table__value ${isBest ? 'comparison-table__value--best' : ''}`}>
                      <span className="spec-value">{value ? `${value} tok/s` : '—'}</span>
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="comparison-table__label">Max Model Size</td>
                {selectedGPUs.map((gpu) => {
                  const { value, isBest } = getCompareValue(gpu, g => g.benchmarks?.maxModelSizeBillions);
                  return (
                    <td key={gpu.id} className={`comparison-table__value ${isBest ? 'comparison-table__value--best' : ''}`}>
                      <span className="spec-value">{value ? `${value}B params` : '—'}</span>
                    </td>
                  );
                })}
              </tr>

              {/* Memory Section */}
              <tr className="comparison-table__section-header">
                <td colSpan={selectedGPUs.length + 1}>Memory</td>
              </tr>
              <tr>
                <td className="comparison-table__label">VRAM</td>
                {selectedGPUs.map((gpu) => {
                  const { value, isBest } = getCompareValue(gpu, g => g.vramGb);
                  return (
                    <td key={gpu.id} className={`comparison-table__value ${isBest ? 'comparison-table__value--best' : ''}`}>
                      <span className="spec-value">{value}GB</span>
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="comparison-table__label">VRAM Type</td>
                {selectedGPUs.map((gpu) => (
                  <td key={gpu.id} className="comparison-table__value">
                    <span className="spec-value">{gpu.vramType}</span>
                  </td>
                ))}
              </tr>
              <tr>
                <td className="comparison-table__label">Memory Bandwidth</td>
                {selectedGPUs.map((gpu) => {
                  const { value, isBest } = getCompareValue(gpu, g => g.memoryBandwidthGbps);
                  return (
                    <td key={gpu.id} className={`comparison-table__value ${isBest ? 'comparison-table__value--best' : ''}`}>
                      <span className="spec-value">{formatNumber(value || 0)} GB/s</span>
                    </td>
                  );
                })}
              </tr>

              {/* Compute Section */}
              <tr className="comparison-table__section-header">
                <td colSpan={selectedGPUs.length + 1}>Compute</td>
              </tr>
              <tr>
                <td className="comparison-table__label">Architecture</td>
                {selectedGPUs.map((gpu) => (
                  <td key={gpu.id} className="comparison-table__value">
                    <span className="spec-value">{gpu.architecture}</span>
                  </td>
                ))}
              </tr>
              <tr>
                <td className="comparison-table__label">CUDA / Stream Processors</td>
                {selectedGPUs.map((gpu) => {
                  const cores = gpu.cudaCores || gpu.streamProcessors || gpu.xeCores;
                  const { isBest } = getCompareValue(gpu, g => g.cudaCores || g.streamProcessors || g.xeCores);
                  return (
                    <td key={gpu.id} className={`comparison-table__value ${isBest ? 'comparison-table__value--best' : ''}`}>
                      <span className="spec-value">{cores ? formatNumber(cores) : '—'}</span>
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="comparison-table__label">Tensor Cores</td>
                {selectedGPUs.map((gpu) => {
                  const { value, isBest } = getCompareValue(gpu, g => g.tensorCores);
                  return (
                    <td key={gpu.id} className={`comparison-table__value ${isBest ? 'comparison-table__value--best' : ''}`}>
                      <span className="spec-value">{value ? formatNumber(value) : '—'}</span>
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="comparison-table__label">Boost Clock</td>
                {selectedGPUs.map((gpu) => {
                  const { value, isBest } = getCompareValue(gpu, g => g.boostClockMhz);
                  return (
                    <td key={gpu.id} className={`comparison-table__value ${isBest ? 'comparison-table__value--best' : ''}`}>
                      <span className="spec-value">{formatNumber(value || 0)} MHz</span>
                    </td>
                  );
                })}
              </tr>

              {/* Power Section */}
              <tr className="comparison-table__section-header">
                <td colSpan={selectedGPUs.length + 1}>Power & Efficiency</td>
              </tr>
              <tr>
                <td className="comparison-table__label">TDP</td>
                {selectedGPUs.map((gpu) => {
                  const { value, isBest } = getCompareValue(gpu, g => g.tdpWatts, false);
                  return (
                    <td key={gpu.id} className={`comparison-table__value ${isBest ? 'comparison-table__value--best' : ''}`}>
                      <span className="spec-value">{value}W</span>
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="comparison-table__label">Perf/Watt (SDXL)</td>
                {selectedGPUs.map((gpu) => {
                  const perfPerWatt = gpu.benchmarks?.sdxlImgsPerMin
                    ? (gpu.benchmarks.sdxlImgsPerMin / gpu.tdpWatts) * 100
                    : undefined;
                  const { isBest } = getCompareValue(gpu, g =>
                    g.benchmarks?.sdxlImgsPerMin ? (g.benchmarks.sdxlImgsPerMin / g.tdpWatts) * 100 : undefined
                  );
                  return (
                    <td key={gpu.id} className={`comparison-table__value ${isBest ? 'comparison-table__value--best' : ''}`}>
                      <span className="spec-value">{perfPerWatt ? perfPerWatt.toFixed(2) : '—'}</span>
                    </td>
                  );
                })}
              </tr>

              {/* Other Section */}
              <tr className="comparison-table__section-header">
                <td colSpan={selectedGPUs.length + 1}>Other</td>
              </tr>
              <tr>
                <td className="comparison-table__label">Release Date</td>
                {selectedGPUs.map((gpu) => (
                  <td key={gpu.id} className="comparison-table__value">
                    <span className="spec-value">
                      {new Date(gpu.releaseDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </span>
                  </td>
                ))}
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td></td>
                {selectedGPUs.map((gpu) => (
                  <td key={gpu.id} className="comparison-table__cta">
                    <a
                      href={`/gpus/${gpu.slug}`}
                      className="btn btn--primary"
                    >
                      View Details
                    </a>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <style>{`
        .gpu-compare {
          width: 100%;
        }

        .gpu-selector {
          margin-bottom: var(--spacing-6);
        }

        .gpu-selector__slots {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: var(--spacing-3);
        }

        .gpu-selector__slot {
          display: flex;
          gap: var(--spacing-2);
        }

        .gpu-selector__select {
          flex: 1;
          padding: var(--spacing-2) var(--spacing-3);
          background-color: var(--bg-secondary);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-size: 0.875rem;
          cursor: pointer;
        }

        .gpu-selector__select:focus {
          outline: none;
          border-color: var(--brand-primary);
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--brand-primary) 20%, transparent);
        }

        .gpu-selector__remove {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          padding: 0;
          background: none;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .gpu-selector__remove:hover {
          border-color: var(--color-error);
          color: var(--color-error);
        }

        .gpu-compare__empty {
          text-align: center;
          padding: var(--spacing-12);
          background-color: var(--bg-secondary);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-lg);
          color: var(--text-muted);
        }

        .comparison-table-wrapper {
          overflow-x: auto;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-lg);
          background-color: var(--bg-secondary);
        }

        .comparison-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.875rem;
        }

        .comparison-table__header {
          padding: var(--spacing-4);
          text-align: center;
          background-color: var(--bg-tertiary);
          border-bottom: 1px solid var(--border-default);
        }

        .comparison-table__header--sticky {
          position: sticky;
          left: 0;
          text-align: left;
          background-color: var(--bg-tertiary);
          z-index: 1;
          min-width: 180px;
        }

        .comparison-table__header--gpu {
          min-width: 160px;
          vertical-align: top;
        }

        .comparison-table__gpu-name {
          display: block;
          font-weight: 600;
          margin: var(--spacing-2) 0;
          color: var(--text-primary);
        }

        .comparison-table__section-header td {
          padding: var(--spacing-3) var(--spacing-4);
          background-color: var(--bg-tertiary);
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          font-size: 0.75rem;
          letter-spacing: 0.05em;
        }

        .comparison-table__label {
          padding: var(--spacing-3) var(--spacing-4);
          color: var(--text-secondary);
          border-bottom: 1px solid var(--border-default);
          position: sticky;
          left: 0;
          background-color: var(--bg-secondary);
        }

        .comparison-table__value {
          padding: var(--spacing-3) var(--spacing-4);
          text-align: center;
          border-bottom: 1px solid var(--border-default);
          color: var(--text-primary);
        }

        .comparison-table__value--best {
          background-color: color-mix(in srgb, var(--color-value-excellent) 10%, transparent);
          font-weight: 600;
        }

        .comparison-table__value--best .spec-value,
        .comparison-table__value--best .price {
          color: var(--color-value-excellent);
        }

        .comparison-table__cta {
          padding: var(--spacing-4);
          text-align: center;
        }

        .comparison-table tbody tr:hover .comparison-table__label,
        .comparison-table tbody tr:hover .comparison-table__value {
          background-color: var(--bg-tertiary);
        }

        .comparison-table tbody tr:hover .comparison-table__value--best {
          background-color: color-mix(in srgb, var(--color-value-excellent) 15%, transparent);
        }

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
      `}</style>
    </div>
  );
}
