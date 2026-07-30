/**
 * Shared layout grammar — the archive's notation system.
 *
 * Section heads read as shelf labels, dividers are sprocket-perforated film
 * edge, data is typewritten, and a title's provider coordinates are printed
 * beneath it the way a can carries its accession number. Colour and type come
 * from the tokens in index.css; only the grammar lives here.
 */
import { Link } from 'react-router-dom';
import {
  fromNormalized,
  scaleForMediaType,
  type MediaType,
  type RatingScale,
} from '@cinelog/contracts';
import { cn } from '../lib/cn';
import { posterGradient } from '../lib/poster';

/**
 * Shelf label: a condensed caps heading over a perforated rule, with an
 * optional count set as a machine record and a link out to the right.
 */
export function SectionHeader({
  title,
  count,
  more,
  moreLabel = 'More',
  right,
}: {
  title: string;
  /** Rendered as a typewritten tally beside the heading. */
  count?: number;
  more?: string;
  moreLabel?: string;
  right?: React.ReactNode;
}): JSX.Element {
  return (
    <div className="mb-3">
      <div className="flex items-baseline justify-between gap-3 pb-1.5">
        <h2 className="flex items-baseline gap-2 font-cond text-[13px] font-extrabold uppercase tracking-[0.16em] text-content">
          {title}
          {count != null && (
            <span className="font-data text-[11px] font-normal tracking-normal text-muted-2">
              {count}
            </span>
          )}
        </h2>
        {right ??
          (more ? (
            <Link
              to={more}
              className="font-cond text-[11px] font-bold uppercase tracking-[0.14em] text-muted-2 hover:text-gold"
            >
              {moreLabel}
            </Link>
          ) : null)}
      </div>
      <div className="rule-perf" />
    </div>
  );
}

/**
 * A bare poster tile. The title lives in the tooltip and alt text — artwork
 * first, text on demand, which is how a dense shelf actually reads.
 */
export function Poster({
  title,
  type,
  posterUrl,
  to,
  onClick,
  rating,
  ratingScale,
  ratingLabel,
  liked,
  className,
}: {
  title: string;
  type?: MediaType;
  posterUrl?: string | null;
  to?: string;
  onClick?: () => void;
  /** Normalized 0..100 — shown as the shared corner badge. */
  rating?: number | null;
  /** Omit to derive it from `type`, which is nearly always what you want. */
  ratingScale?: RatingScale;
  /** Tooltip naming whose rating this is; see PosterMarks. */
  ratingLabel?: string;
  liked?: boolean;
  className?: string;
}): JSX.Element {
  const tile = (
    <span
      className={cn(
        'group relative block aspect-[2/3] w-full overflow-hidden rounded-sm bg-card',
        'ring-1 ring-border-hi/60 transition-[box-shadow,border-color] duration-150',
        'hover:z-10 hover:ring-2 hover:ring-gold group-focus-visible:ring-2 group-focus-visible:ring-gold',
      )}
    >
      {posterUrl ? (
        <img src={posterUrl} alt={title} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <span className="absolute inset-0 block" style={{ background: posterGradient(title) }}>
          <span className="absolute inset-x-1.5 bottom-2 block font-cond text-[13px] font-extrabold uppercase leading-tight text-white/95">
            {title}
          </span>
        </span>
      )}
      <PosterMarks
        type={type}
        rating={rating}
        ratingScale={ratingScale}
        ratingLabel={ratingLabel}
        liked={liked}
      />
    </span>
  );

  return (
    <div className={cn('w-full', className)}>
      {to ? (
        <Link to={to} title={title} aria-label={title} className="block focus:outline-none">
          {tile}
        </Link>
      ) : (
        <button
          type="button"
          onClick={onClick}
          title={title}
          aria-label={title}
          className="block w-full focus:outline-none"
        >
          {tile}
        </button>
      )}
    </div>
  );
}

/**
 * Every mark that goes on a poster tile: the medium's stock label top-left,
 * then your like and your rating top-right.
 *
 * This exists so the two tile components can't drift apart again — they had,
 * with one growing a type label the other never got. There is exactly one
 * badge design in the app, and both tiles render it from here.
 */
export function PosterMarks({
  type,
  rating,
  ratingScale,
  ratingLabel,
  liked = false,
}: {
  type?: MediaType;
  /** Normalized 0..100. */
  rating?: number | null;
  /** Omit to derive it from `type`, which is nearly always what you want. */
  ratingScale?: RatingScale;
  /**
   * Names whose rating this is, as a tooltip. Browse surfaces show the
   * instance average rather than your own score, and the badge looks the same
   * either way, so the distinction is carried here instead of in the styling.
   */
  ratingLabel?: string;
  liked?: boolean;
}): JSX.Element {
  const hasRating = rating !== null && rating !== undefined;
  return (
    <>
      {type && (
        <span className="absolute left-0 top-0 bg-bg-2/90 px-1.5 py-[3px] font-cond text-[11px] font-extrabold uppercase tracking-[0.12em] text-content/90">
          {TYPE_LABEL_SHORT[type]}
        </span>
      )}
      {(hasRating || liked) && (
        <span className="absolute right-0 top-0 flex items-stretch">
          {liked && (
            <span
              title="You liked this"
              className="flex items-center bg-bg-2/95 px-1.5 text-[13px] leading-none text-rose"
            >
              ♥
            </span>
          )}
          {hasRating && (
            <span
              title={ratingLabel ?? 'Your rating'}
              className="flex items-center gap-0.5 bg-gold px-1.5 py-1 font-data text-[13px] font-bold leading-none text-ink"
            >
              <span aria-hidden="true" className="text-[11px] leading-none">
                ★
              </span>
              {fromNormalized(rating, ratingScale ?? scaleForMediaType(type ?? 'MOVIE'))}
            </span>
          )}
        </span>
      )}
    </>
  );
}

/** Dense caption-less poster grid — the backbone of every browse surface. */
export function PosterGrid({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="grid grid-cols-3 gap-x-2.5 gap-y-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
      {children}
    </div>
  );
}

/** A horizontally scrolling poster rail, for "recent"/"popular" strips. */
export function PosterRail({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="rail-mask -mx-2 overflow-x-auto px-1 pb-2 pt-2 scrollbar-none">
      <div className="flex gap-2.5">{children}</div>
    </div>
  );
}

/** Inline ★★★★½ rating text, using the overlay-fill technique from index.css. */
export function StarText({
  value,
  size = 13,
  className,
}: {
  /** Normalized 0..100. */
  value: number;
  size?: number;
  className?: string;
}): JSX.Element {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <span
      className={cn('stars', className)}
      style={{ fontSize: size }}
      aria-label={`${Math.round((pct / 20) * 10) / 10} out of 5 stars`}
    >
      <span className="stars-fill" style={{ width: `${pct}%` }} />
    </span>
  );
}

/**
 * A title's provider coordinates, typewritten — the accession line. This is
 * the detail that makes a screen read as a catalogue record rather than a
 * storefront, and it is genuinely useful: it is the id you would search for.
 */
export function Accession({
  provider,
  externalId,
  year,
  runtime,
  className,
}: {
  provider?: string | null;
  externalId?: string | null;
  year?: number | null;
  runtime?: number | null;
  className?: string;
}): JSX.Element | null {
  const parts: string[] = [];
  if (provider && externalId) parts.push(`${provider}·${externalId.replace(/^\w+:/, '')}`);
  if (year) parts.push(String(year));
  if (runtime) parts.push(formatRuntime(runtime));
  if (parts.length === 0) return null;
  return (
    <p className={cn('font-data text-[11px] leading-none text-muted-2', className)}>
      {parts.join('  ·  ')}
    </p>
  );
}

/**
 * A duration as a person would say it: 2h 18m, not 138m. Feature lengths are
 * read as hours, so minute counts past an hour make you do the division
 * yourself. Under an hour there's nothing to convert.
 */
export function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export interface TabItem {
  key: string;
  label: string;
  count?: number;
}

/** Index-tab bar: condensed caps, counts typewritten, active tab ruled in ink. */
export function TabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
}): JSX.Element {
  return (
    <div
      role="tablist"
      className="flex gap-0.5 overflow-x-auto border-b border-border scrollbar-none"
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={active === t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            'shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 font-cond text-[13px] font-bold uppercase tracking-[0.13em] transition-colors',
            active === t.key
              ? 'border-gold text-content'
              : 'border-transparent text-muted hover:text-content',
          )}
        >
          {t.label}
          {t.count != null && (
            <span className="ml-1.5 font-data text-[11px] font-normal tracking-normal text-muted-2">
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/** Abbreviated medium, for the poster corner label where space is tight. */
export const TYPE_LABEL_SHORT: Record<MediaType, string> = {
  MOVIE: 'Film',
  TV: 'Show',
  ANIME: 'Anime',
  CARTOON: 'Cartoon',
  DOCUMENTARY: 'Doc',
  MINISERIES: 'Mini',
  SPECIAL: 'Special',
};

/** Type label shown on browse filters and detail headers. */
export const TYPE_LABEL: Record<MediaType, string> = {
  MOVIE: 'Film',
  TV: 'Show',
  ANIME: 'Anime',
  CARTOON: 'Cartoon',
  DOCUMENTARY: 'Documentary',
  MINISERIES: 'Miniseries',
  SPECIAL: 'Special',
};

/** An empty shelf: ruled card stock with the reason typed onto it. */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
}): JSX.Element {
  return (
    <div className="rounded-sm border border-dashed border-border-hi bg-surface/40 px-6 py-14 text-center">
      <p className="font-cond text-lg font-extrabold uppercase tracking-[0.06em] text-content">
        {title}
      </p>
      {body && <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">{body}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
