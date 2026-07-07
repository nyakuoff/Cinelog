import type { TrackingStatus } from '@cinelog/contracts';
import { cn } from '../lib/cn';

export const STATUS_LABELS: Record<TrackingStatus, string> = {
  WATCHING: 'Watching',
  COMPLETED: 'Completed',
  PLAN_TO_WATCH: 'Plan to Watch',
  ON_HOLD: 'On Hold',
  DROPPED: 'Dropped',
  REWATCHING: 'Rewatching',
};

const ORDER: TrackingStatus[] = [
  'WATCHING',
  'COMPLETED',
  'PLAN_TO_WATCH',
  'ON_HOLD',
  'DROPPED',
  'REWATCHING',
];

interface Props {
  value: TrackingStatus | null;
  onChange: (value: TrackingStatus | null) => void;
  className?: string;
}

export function StatusPicker({ value, onChange, className }: Props): JSX.Element {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange((e.target.value || null) as TrackingStatus | null)}
      className={cn(
        'h-10 rounded-xl border border-border bg-surface-2 px-3 pr-8 text-sm text-content',
        'focus:outline-none focus:ring-2 focus:ring-accent/50',
        className,
      )}
    >
      <option value="">Set status…</option>
      {ORDER.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
