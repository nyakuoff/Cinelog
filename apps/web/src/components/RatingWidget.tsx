import { useState } from 'react';
import { fromNormalized, RATING_SCALES, type RatingScale } from '@cinelog/contracts';
import { cn } from '../lib/cn';
import { Button } from './ui';

interface WidgetProps {
  value: number | null;
  scale: RatingScale;
  onChange: (value: number | null) => void;
  readOnly?: boolean;
}

/** Personal rating control that respects the user's configured scale. */
export function RatingWidget({ value, scale, onChange, readOnly }: WidgetProps): JSX.Element {
  const cfg = RATING_SCALES[scale];
  if (!cfg.isStars) {
    return <NumericRating value={value} scale={scale} onChange={onChange} readOnly={readOnly} />;
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <StarInput value={value} scale={scale} onChange={onChange} readOnly={readOnly} size={cfg.max === 10 ? 19 : 26} />
      {value !== null && (
        <span className="font-cond text-lg font-extrabold tabular-nums text-gold">
          {fromNormalized(value, scale)}
          <span className="text-xs text-muted-2">/{cfg.max}</span>
        </span>
      )}
      {value !== null && !readOnly && (
        <button type="button" className="text-xs text-muted hover:text-content" onClick={() => onChange(null)}>
          Clear
        </button>
      )}
    </div>
  );
}

interface StarInputProps {
  value: number | null;
  scale: RatingScale;
  onChange: (value: number | null) => void;
  readOnly?: boolean;
  size?: number;
}

/**
 * Renders one star per point on the scale — 5 stars for a five-point scale,
 * 10 for a ten-point scale — so a 5/10 reads as five filled stars (half =
 * average) rather than 2.5. Ten-star rows are grouped 5+5 to stay legible.
 * Half-stars are enabled only for the explicit half-star scale.
 */
export function StarInput({ value, scale, onChange, readOnly, size = 24 }: StarInputProps): JSX.Element {
  const cfg = RATING_SCALES[scale];
  const perStar = 100 / cfg.max; // normalized points per star
  const allowHalf = cfg.step === 0.5;
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0; // normalized 0..100
  const fillStars = shown / perStar;

  const pick = (starIndex: number, e: React.MouseEvent<HTMLButtonElement>): number =>
    Math.round(starIndex * perStar - (allowHalf && isLeftHalf(e) ? perStar / 2 : 0));

  return (
    <div className="flex items-center" onMouseLeave={() => setHover(null)}>
      {Array.from({ length: cfg.max }, (_, i) => {
        const starIndex = i + 1;
        const fill = Math.max(0, Math.min(1, fillStars - i));
        // Split a ten-star row into two groups of five.
        const groupGap = cfg.max === 10 && i === 5;
        return (
          <button
            key={starIndex}
            type="button"
            disabled={readOnly}
            className={cn('relative p-px', groupGap && 'ml-1.5', !readOnly && 'cursor-pointer')}
            onMouseMove={(e) => !readOnly && setHover(pick(starIndex, e))}
            onClick={(e) => {
              if (readOnly) return;
              const next = pick(starIndex, e);
              onChange(value === next ? null : next); // click current value again to clear
            }}
            aria-label={`Rate ${fromNormalized(Math.round(starIndex * perStar), scale)}`}
          >
            <Star fill={fill} size={size} />
          </button>
        );
      })}
    </div>
  );
}

function isLeftHalf(e: React.MouseEvent<HTMLButtonElement>): boolean {
  const rect = e.currentTarget.getBoundingClientRect();
  if (!rect.width) return false;
  return e.clientX - rect.left < rect.width / 2;
}

function Star({ fill, size }: { fill: number; size: number }): JSX.Element {
  return (
    <span className="relative inline-block leading-none" style={{ width: size, height: size }}>
      <StarSvg size={size} className="absolute inset-0 text-border-hi" />
      <span className="absolute inset-0 overflow-hidden" style={{ width: `${Math.round(fill * 100)}%` }}>
        <StarSvg size={size} className="text-gold" />
      </span>
    </span>
  );
}

function StarSvg({ size, className }: { size: number; className?: string }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 17.3l-5.4 3.3 1.4-6.2-4.7-4.1 6.3-.5L12 4l2.4 5.8 6.3.5-4.7 4.1 1.4 6.2z" />
    </svg>
  );
}

function NumericRating({ value, scale, onChange, readOnly }: WidgetProps): JSX.Element {
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
          if (Number.isFinite(num)) onChange(Math.max(0, Math.min(100, (num / cfg.max) * 100)));
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
