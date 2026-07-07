import { useState } from 'react';
import { fromNormalized, RATING_SCALES, toNormalized, type RatingScale } from '@cinelog/contracts';
import { cn } from '../lib/cn';
import { Button } from './ui';

interface Props {
  /** Normalized 0..100, or null when unrated. */
  value: number | null;
  scale: RatingScale;
  onChange: (value: number | null) => void;
  readOnly?: boolean;
}

/** Personal rating control that respects the user's configured scale. */
export function RatingWidget({ value, scale, onChange, readOnly }: Props): JSX.Element {
  const cfg = RATING_SCALES[scale];
  if (cfg.isStars) {
    return (
      <div className="flex items-center gap-3">
        <StarRating value={value} scale={scale} onChange={onChange} readOnly={readOnly} />
        {value !== null && !readOnly && (
          <button
            type="button"
            className="text-xs text-muted hover:text-content"
            onClick={() => onChange(null)}
          >
            Clear
          </button>
        )}
      </div>
    );
  }
  return <NumericRating value={value} scale={scale} onChange={onChange} readOnly={readOnly} />;
}

function StarRating({ value, scale, onChange, readOnly }: Props): JSX.Element {
  const cfg = RATING_SCALES[scale];
  const [hover, setHover] = useState<number | null>(null);
  const display = hover ?? (value !== null ? fromNormalized(value, scale) : 0);
  const allowHalf = cfg.step === 0.5;

  return (
    <div className="flex items-center gap-0.5" onMouseLeave={() => setHover(null)}>
      {Array.from({ length: cfg.max }, (_, i) => {
        const starIndex = i + 1;
        const fill = Math.max(0, Math.min(1, display - i)); // 0, 0.5, or 1
        return (
          <button
            key={starIndex}
            type="button"
            disabled={readOnly}
            className={cn('relative p-0.5', !readOnly && 'cursor-pointer')}
            onMouseMove={(e) => {
              if (readOnly) return;
              const half = allowHalf && isLeftHalf(e);
              setHover(starIndex - (half ? 0.5 : 0));
            }}
            onClick={(e) => {
              if (readOnly) return;
              const half = allowHalf && isLeftHalf(e);
              onChange(toNormalized(starIndex - (half ? 0.5 : 0), scale));
            }}
            aria-label={`${starIndex} star${starIndex > 1 ? 's' : ''}`}
          >
            <Star fill={fill} />
          </button>
        );
      })}
    </div>
  );
}

function isLeftHalf(e: React.MouseEvent<HTMLButtonElement>): boolean {
  const rect = e.currentTarget.getBoundingClientRect();
  return e.clientX - rect.left < rect.width / 2;
}

function Star({ fill }: { fill: number }): JSX.Element {
  const pct = `${Math.round(fill * 100)}%`;
  return (
    <span className="relative inline-block h-6 w-6 leading-none">
      <StarSvg className="absolute inset-0 text-border" />
      <span className="absolute inset-0 overflow-hidden" style={{ width: pct }}>
        <StarSvg className="text-accent" />
      </span>
    </span>
  );
}

function StarSvg({ className }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={cn('h-6 w-6', className)}>
      <path d="M12 17.3l-5.4 3.3 1.4-6.2-4.7-4.1 6.3-.5L12 4l2.4 5.8 6.3.5-4.7 4.1 1.4 6.2z" />
    </svg>
  );
}

function NumericRating({ value, scale, onChange, readOnly }: Props): JSX.Element {
  const cfg = RATING_SCALES[scale];
  const display = value !== null ? fromNormalized(value, scale) : '';
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={0}
        max={cfg.max}
        step={cfg.step}
        value={display}
        disabled={readOnly}
        placeholder="—"
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') return onChange(null);
          const num = Number(raw);
          if (Number.isFinite(num)) onChange(toNormalized(num, scale));
        }}
        className="h-9 w-20 rounded-xl border border-border bg-surface-2 px-3 text-sm"
      />
      <span className="text-sm text-muted">/ {cfg.max}</span>
      {value !== null && !readOnly && (
        <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
          Clear
        </Button>
      )}
    </div>
  );
}
