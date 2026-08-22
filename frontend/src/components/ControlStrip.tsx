import { useState } from 'react';
import { ArrowUpDown, Filter, Layers, Search, X } from 'lucide-react';

export interface StripOption { value: string; label: string }

/**
 * The search / group / filter / sort row the wireframes put on every list
 * screen. Each control is optional, so a screen only shows the ones it uses.
 */
export function ControlStrip({
  query, onQuery, placeholder = 'Search…',
  groupBy, groupOptions, onGroupBy,
  sortBy, sortOptions, onSortBy,
  filterLabel, filterCount, filterPanel,
}: {
  query: string;
  onQuery: (value: string) => void;
  placeholder?: string;
  groupBy?: string;
  groupOptions?: StripOption[];
  onGroupBy?: (value: string) => void;
  sortBy?: string;
  sortOptions?: StripOption[];
  onSortBy?: (value: string) => void;
  filterLabel?: string;
  filterCount?: number;
  filterPanel?: React.ReactNode;
}) {
  // The panel opens on demand, and stays open while filters are set.
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="card mb-5 overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 p-2">
        <div className="relative min-w-[180px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mist" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={placeholder}
            className="field pl-9 pr-8"
            type="search"
          />
          {query && (
            <button
              onClick={() => onQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-mist hover:text-ink"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {groupOptions && (
          <StripSelect icon={Layers} label="Group by" value={groupBy ?? ''} options={groupOptions} onChange={onGroupBy!} />
        )}

        {filterPanel && (
          <button
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            className={`inline-flex h-10 items-center gap-1.5 rounded-[10px] border px-3 text-[13px] font-medium transition-colors ${
              showFilters || filterCount ? 'border-route bg-route-soft text-route' : 'border-rule bg-surface text-slate hover:bg-canvas'
            }`}
          >
            <Filter size={14} />
            {filterLabel ?? 'Filter'}
            {!!filterCount && <span className="num rounded-full bg-route px-1.5 text-[10px] text-white">{filterCount}</span>}
          </button>
        )}

        {sortOptions && (
          <StripSelect icon={ArrowUpDown} label="Sort by" value={sortBy ?? ''} options={sortOptions} onChange={onSortBy!} />
        )}
      </div>

      {filterPanel && showFilters && (
        <div className="rise border-t bg-canvas/60 p-3">{filterPanel}</div>
      )}
    </div>
  );
}

function StripSelect({ icon: Icon, label, value, options, onChange }: {
  icon: any; label: string; value: string; options: StripOption[]; onChange: (value: string) => void;
}) {
  return (
    <label className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-rule bg-surface pl-3 pr-1 text-[13px] text-slate">
      <Icon size={14} className="shrink-0 text-mist" />
      <span className="hidden shrink-0 sm:inline">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-full max-w-[130px] cursor-pointer appearance-none bg-transparent pr-6 pl-1 font-medium text-ink focus:outline-none"
        aria-label={label}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2356697A' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 6px center',
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
