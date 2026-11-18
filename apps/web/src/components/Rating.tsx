/**
 * Ratings — one way to show one, one way to give one.
 *
 * Values are normalized 0..100 everywhere in the app; the scale they're drawn
 * on follows the title's media type (films out of five, shows out of ten —
 * see `scaleForMediaType`), so nothing here ever takes a bare "out of ten".
 */
import { useRef, useState } from 'react';
import { plural } from '../lib/format';
import {
  fromNormalized,
  RATING_SCALES,
  scaleForMediaType,
  type MediaType,
  type RatingScale,
} from '@cinelog/contracts';
import { cn } from '../lib/cn';
import { IconStar, IconX } from './app/Icons';

/** Stars are the only entry/display form; a numeric scale is drawn on ten. */
function starScale(scale: RatingScale): RatingScale {
  return RATING_SCALES[scale].isStars ? scale : 'TEN_HALF';
}

/**
 * A rating as typed text, in the scale's own units. `average` keeps one
 * decimal instead of snapping to the scale's step — a mean of 3.7 is not 3.5.
 */
export function formatRating(value: number, scale: RatingScale, average = false): string {
  if (!average) return String(fromNormalized(value, scale));
  const v = ((Math.max(0, Math.min(100, value)) / 100) * RATING_SCALES[scale].max).toFixed(1);
  return v.endsWith('.0') ? v.slice(0, -2) : v;
}

/**
 * A rating, displayed.
 *
 * `stars` (default) draws the row of stars; `number` types it — `★ 4.5`, or
 * `★ 7.5/10` on the ten scale so a show never reads as comparable to a film.
 * Amber is a person's own mark; pass `average` for anything computed (a
 * community or season mean), which is set in plain ink instead.
 */
export function RatingMark({
  value,
  type,
  scale: scaleProp,
  display = 'stars',
  average = false,
  size = 13,
  className,
}: {
  /** Normalized 0..100. */
  value: number;
  /** The title's media type; picks the scale. */
  type?: MediaType;
  /** Override the scale directly (rarely needed — prefer `type`). */
  scale?: RatingScale;
  display?: 'stars' | 'number';
  average?: boolean;
  /** Font size in px. */
  size?: number;
  className?: string;
}): JSX.Element {
  const scale = starScale(scaleProp ?? scaleForMediaType(type ?? 'MOVIE'));
  const max = RATING_SCALES[scale].max;
  const text = formatRating(value, scale, average);
  const label = `${average ? 'Average ' : ''}${text} out of ${max}`;

  if (display === 'number') {
    return (
      <span
        title={label}
        aria-label={label}
        style={{ fontSize: size }}
        className={cn(
          'inline-flex items-baseline gap-[0.25em] whitespace-nowrap font-data font-bold leading-none',
          average ? 'text-content' : 'text-gold',
          className,
        )}
      >
        <IconStar className="h-[0.8em] w-[0.8em] self-center" />
        <span>
          {text}
          {max !== 5 && <span className="text-[0.8em] font-normal opacity-75">/{max}</span>}
        </span>
      </span>
    );
  }

  return (
    <span
      className={cn('stars', max === 10 && 'stars-10', average && 'stars-average', className)}
      style={{ fontSize: size }}
      role="img"
      title={label}
      aria-label={label}
    >
      <span className="stars-fill" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </span>
  );
}

/**
 * A rating, entered.
 *
 * One star per point on the scale. The row is a single slider, not ten
 * buttons: drag across it, click a half, or use the arrow keys. The ✕ before
 * the stars is the only way to clear, and it is always in the same place.
 *
 * Stars size to the room they're given (up to a cap), so the same control is
 * 19px stars in the desktop rail and ~30px across a phone. Half a small star
 * is too fine a target for a finger, so a tap sets the whole star and a second
 * tap on it drops to the half; a drag or a mouse click reads the exact half.
 */
export function StarInput({
  value,
  scale: scaleProp,
  onChange,
  disabled,
  size = 'md',
  label = 'Your rating',
  align = 'start',
  className,
}: {
  /** Normalized 0..100, or null when unrated. */
  value: number | null;
  scale: RatingScale;
  onChange: (value: number | null) => void;
  disabled?: boolean;
  /** `sm` for list rows (episodes); `md` wherever the rating is the point. */
  size?: 'sm' | 'md';
  label?: string;
  /** `center` mirrors the clear button with a spacer, so the stars — not the
   *  stars plus the button — sit on the centre line. */
  align?: 'start' | 'center';
  className?: string;
}): JSX.Element {
  const scale = starScale(scaleProp);
  const cfg = RATING_SCALES[scale];
  const perStar = 100 / cfg.max;
  const stepN = cfg.step * perStar;
  const allowHalf = cfg.step === 0.5;
  const current = value === null ? null : Math.round(value);

  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; moved: boolean; mouse: boolean } | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const shown = preview ?? current ?? 0;

  const maxCell = size === 'sm' ? (cfg.max === 10 ? 24 : 28) : cfg.max === 10 ? 30 : 40;

  /** Normalized value under a pointer; `precise` honours the half-star side. */
  function valueAt(clientX: number, precise: boolean): number {
    const r = track.current!.getBoundingClientRect();
    const cell = r.width / cfg.max;
    const x = Math.max(0, Math.min(r.width - 0.01, clientX - r.left));
    const idx = Math.floor(x / cell);
    const half = allowHalf && precise && x - idx * cell < cell / 2;
    return Math.round((idx + (half ? 0.5 : 1)) * perStar);
  }

  function commit(next: number | null): void {
    if (next !== current) onChange(next);
  }

  return (
    <div className={cn('flex items-center gap-1', align === 'center' && 'justify-center', className)}>
      <button
        type="button"
        onClick={() => onChange(null)}
        disabled={disabled}
        aria-label="Clear rating"
        title="Clear rating"
        className={cn(
          'grid h-8 w-8 shrink-0 place-items-center rounded-sm text-muted-2 hover:bg-surface-2 hover:text-content',
          'focus:outline-none focus-visible:ring-1 focus-visible:ring-accent',
          current === null && 'invisible',
        )}
      >
        <IconX className="h-3.5 w-3.5" />
      </button>

      <div
        ref={track}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-disabled={disabled}
        aria-valuemin={0}
        aria-valuemax={cfg.max}
        aria-valuenow={current === null ? 0 : fromNormalized(current, scale)}
        aria-valuetext={
          current === null ? 'Not rated' : `${fromNormalized(current, scale)} out of ${cfg.max}`
        }
        style={{ maxWidth: cfg.max * maxCell }}
        className={cn(
          // pan-y: a vertical swipe that starts on the stars still scrolls the
          // page (and cancels the gesture); a horizontal one is ours.
          'flex min-w-0 flex-1 touch-pan-y select-none rounded-sm py-1.5',
          'focus:outline-none focus-visible:ring-1 focus-visible:ring-accent',
          disabled ? 'opacity-60' : 'cursor-pointer',
        )}
        onPointerDown={(e) => {
          if (disabled || e.button !== 0) return;
          const mouse = e.pointerType === 'mouse';
          drag.current = { x: e.clientX, moved: false, mouse };
          e.currentTarget.setPointerCapture(e.pointerId);
          setPreview(valueAt(e.clientX, mouse));
        }}
        onPointerMove={(e) => {
          if (disabled) return;
          const d = drag.current;
          if (d) {
            if (Math.abs(e.clientX - d.x) > 6) d.moved = true;
            setPreview(valueAt(e.clientX, d.mouse || d.moved));
          } else if (e.pointerType === 'mouse') {
            setPreview(valueAt(e.clientX, true));
          }
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          if (!d) return;
          drag.current = null;
          setPreview(null);
          if (d.mouse || d.moved) return commit(valueAt(e.clientX, true));
          const whole = valueAt(e.clientX, false);
          commit(allowHalf && current === whole ? whole - stepN : whole);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setPreview(null);
        }}
        onPointerLeave={() => {
          if (!drag.current) setPreview(null);
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          const cur = current ?? 0;
          let next: number | null | undefined;
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = Math.min(100, cur + stepN);
          else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown')
            next = cur - stepN <= 0 ? null : cur - stepN;
          else if (e.key === 'Home') next = null;
          else if (e.key === 'End') next = 100;
          if (next === undefined) return;
          e.preventDefault();
          commit(next === null ? null : Math.round(next));
        }}
      >
        {Array.from({ length: cfg.max }, (_, i) => {
          const fill = Math.max(0, Math.min(1, shown / perStar - i));
          return (
            <span key={i} className="relative block aspect-square min-w-0 flex-1">
              <IconStar className="block h-full w-full p-px text-border-hi" />
              {fill > 0 && (
                <IconStar
                  className="absolute inset-0 block h-full w-full p-px text-gold"
                  // Clipped rather than cropped in a wrapper, so a half star
                  // is the same star cut in two at any size.
                  style={{ clipPath: `inset(0 ${100 - fill * 100}% 0 0)` }}
                />
              )}
            </span>
          );
        })}
      </div>
      {align === 'center' && <span aria-hidden="true" className="w-8 shrink-0" />}
    </div>
  );
}

/**
 * A rating distribution as a printed tally: ten flat bars (normalized buckets
 * 1..10), the scale's ends labelled beneath, and a readout that names the bar
 * under the pointer or finger. `average` sets the bars in plain ink — an
 * instance's ratings are arithmetic, a member's own are their marks.
 */
export function RatingHistogram({
  buckets,
  type = 'MOVIE',
  average = false,
  height = 48,
  className,
}: {
  buckets: { bucket: number; count: number }[];
  type?: MediaType;
  average?: boolean;
  /** Height of the bars, in px. */
  height?: number;
  className?: string;
}): JSX.Element {
  const [active, setActive] = useState<number | null>(null);
  const scale = scaleForMediaType(type);
  const five = RATING_SCALES[scale].max === 5;
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const total = buckets.reduce((sum, b) => sum + b.count, 0);
  const name = (bucket: number): string =>
    five ? `★ ${formatRating(bucket * 10, scale)}` : `${bucket}/10`;
  const hit = buckets.find((b) => b.bucket === active);
  return (
    <div className={className} onPointerLeave={() => setActive(null)}>
      <div className="flex items-end gap-[2px]" style={{ height }}>
        {buckets.map((b) => (
          <button
            key={b.bucket}
            type="button"
            aria-label={`${name(b.bucket)}: ${plural(b.count, 'rating')}`}
            onPointerEnter={() => setActive(b.bucket)}
            onFocus={() => setActive(b.bucket)}
            onBlur={() => setActive(null)}
            onClick={() => setActive(b.bucket)}
            className="flex h-full flex-1 items-end focus:outline-none"
          >
            <span
              className={cn(
                'block w-full',
                b.count === 0 ? 'bg-border-hi/50' : average ? 'bg-muted' : 'bg-gold',
                active === b.bucket && (b.count === 0 ? 'bg-border-hi' : 'bg-content'),
              )}
              // An empty bucket keeps a baseline tick, so few ratings never
              // read as a broken chart.
              style={{ height: b.count > 0 ? `${Math.max(12, (b.count / max) * 100)}%` : 3 }}
            />
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex items-baseline justify-between gap-2 font-data text-[11px] text-muted-2">
        <span>{five ? '½★' : '1'}</span>
        <span aria-live="polite" className={cn('truncate', hit && 'text-content')}>
          {hit ? `${name(hit.bucket)} — ${plural(hit.count, 'rating')}` : plural(total, 'rating')}
        </span>
        <span>{five ? '★★★★★' : '10'}</span>
      </div>
    </div>
  );
}
