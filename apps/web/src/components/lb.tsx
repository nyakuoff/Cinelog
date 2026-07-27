/**
 * Letterboxd-pattern layout primitives.
 *
 * These encode the structural conventions the whole app follows: caption-less
 * dense poster grids, ruled uppercase section headers with a trailing "more"
 * link, underline tab bars, and inline ★★★★½ star text. Colors/type come from
 * the Cinelog tokens in index.css — only the layout grammar is shared.
 */
import { Link } from 'react-router-dom';
import type { MediaType } from '@cinelog/contracts';
import { cn } from '../lib/cn';
import { posterGradient } from '../lib/poster';

/** Ruled uppercase section header with an optional right-aligned link. */
export function SectionHeader({
  title,
  more,
  moreLabel = 'More',
  right,
}: {
  title: string;
  more?: string;
  moreLabel?: string;
  right?: React.ReactNode;
}): JSX.Element {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-border pb-1.5">
      <h2 className="font-cond text-[13px] font-bold uppercase tracking-[0.14em] text-muted">
        {title}
      </h2>
      {right ??
        (more ? (
          <Link
            to={more}
            className="font-cond text-[11px] font-bold uppercase tracking-[0.14em] text-muted-2 hover:text-content"
          >
            {moreLabel}
          </Link>
        ) : null)}
    </div>
  );
}

/**
 * A bare poster tile — no caption. The title lives in the tooltip and alt text,
 * matching how a dense film grid reads: artwork first, text on demand.
 */
export function Poster({
  title,
  posterUrl,
  to,
  onClick,
  rating,
  liked,
  className,
}: {
  title: string;
  posterUrl?: string | null;
  to?: string;
  onClick?: () => void;
  /** Normalized 0..100 — renders a small star row beneath the tile. */
  rating?: number | null;
  liked?: boolean;
  className?: string;
}): JSX.Element {
  const tile = (
    <span
      className={cn(
        'group relative block aspect-[2/3] w-full overflow-hidden rounded-[3px] bg-card',
        'ring-1 ring-border-hi/50 transition-[box-shadow,transform] duration-150',
        'hover:z-10 hover:ring-2 hover:ring-cyan focus-visible:ring-2 focus-visible:ring-cyan',
      )}
    >
      {posterUrl ? (
        <img
          src={posterUrl}
          alt={title}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="absolute inset-0 block" style={{ background: posterGradient(title) }}>
          <span className="absolute inset-x-1.5 bottom-2 block font-cond text-[13px] font-bold uppercase leading-tight text-white/95">
            {title}
          </span>
        </span>
      )}
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
      {(rating != null || liked) && (
        <div className="mt-1 flex items-center gap-1.5">
          {rating != null && <StarText value={rating} size={11} />}
          {liked && <span className="text-[11px] leading-none text-rose">♥</span>}
        </div>
      )}
    </div>
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
    <div className="-mx-1 overflow-x-auto pb-1">
      <div className="flex gap-2.5 px-1">{children}</div>
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

export interface TabItem {
  key: string;
  label: string;
  count?: number;
}

/** Underlined uppercase tab bar. */
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
            'shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 font-cond text-[12px] font-bold uppercase tracking-[0.12em] transition-colors',
            active === t.key
              ? 'border-gold text-content'
              : 'border-transparent text-muted hover:text-content',
          )}
        >
          {t.label}
          {t.count != null && (
            <span className="ml-1.5 tabular-nums text-muted-2">{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

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

/** Empty-state block used across browse and profile tabs. */
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
    <div className="rounded border border-dashed border-border-hi bg-surface/40 px-6 py-14 text-center">
      <p className="font-cond text-lg font-bold uppercase tracking-tight text-content">{title}</p>
      {body && <p className="mx-auto mt-2 max-w-md text-sm text-muted">{body}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
