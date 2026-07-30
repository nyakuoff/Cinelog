import type { TrackingStatus } from '@cinelog/contracts';
import { cn } from '../lib/cn';
import { Select } from './ui';

export const STATUS_LABELS: Record<TrackingStatus, string> = {
  WATCHING: 'Watching',
  COMPLETED: 'Completed',
  ON_HOLD: 'On Hold',
  DROPPED: 'Dropped',
  REWATCHING: 'Rewatching',
};

const ORDER: TrackingStatus[] = [
  'WATCHING',
  'COMPLETED',
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
    <Select
      value={value ?? ''}
      onChange={(e) => onChange((e.target.value || null) as TrackingStatus | null)}
      className={className}
    >
      <option value="">Set status…</option>
      {ORDER.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABELS[s]}
        </option>
      ))}
    </Select>
  );
}
