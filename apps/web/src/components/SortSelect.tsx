import { SORT_OPTIONS, type SortKey } from '../lib/sortLibrary';
import { Select } from './ui';

/** "Sort by" for the poster grids of your own titles (Library, Watchlist). */
export function SortSelect({
  value,
  onChange,
  className,
}: {
  value: SortKey;
  onChange: (value: SortKey) => void;
  className?: string;
}): JSX.Element {
  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value as SortKey)}
      aria-label="Sort by"
      className={className}
    >
      {SORT_OPTIONS.map((o) => (
        <option key={o.key} value={o.key}>
          Sort: {o.label}
        </option>
      ))}
    </Select>
  );
}
