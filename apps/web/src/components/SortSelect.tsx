import { cn } from '../lib/cn';
import { SORT_OPTIONS, type SortKey } from '../lib/sortLibrary';

interface Props {
  value: SortKey;
  onChange: (value: SortKey) => void;
  className?: string;
}

/** Compact "Sort by" dropdown for poster grids (Home, Watchlist). */
export function SortSelect({ value, onChange, className }: Props): JSX.Element {
  return (
    <label className={cn('flex items-center gap-2', className)}>
      <span className="font-cond text-[11px] font-bold uppercase tracking-[0.12em] text-muted-2">
        Sort
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortKey)}
        aria-label="Sort by"
        className={cn(
          'h-9 rounded-xl border border-border bg-surface px-3 pr-7 text-sm text-content',
          'focus:outline-none focus:ring-2 focus:ring-accent/50',
        )}
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
