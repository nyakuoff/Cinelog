/**
 * Shared layout grammar — the archive's notation system.
 *
 * Page and section heads, the poster tile and its grid/rail, tabs, dates, and
 * empty/error states. Section heads read as shelf labels, dividers are
 * sprocket-perforated film edge, data is typewritten, and a title's provider
 * coordinates are printed beneath it the way a can carries its accession
 * number. Colour and type come from the tokens in index.css; only the grammar
 * lives here. (Controls are in `ui.tsx`, ratings in `Rating.tsx`.)
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { loadMediaDetail } from '../lib/preload';
import { scaleForMediaType, type MediaType, type RatingScale } from '@cinelog/contracts';
import { cn } from '../lib/cn';
import { formatDate } from '../lib/format';
import { posterGradient } from '../lib/poster';
import {
  IconChevronLeft,
  IconChevronRight,
  IconEye,
  IconHeart,
  IconReview,
  IconRewatch,
} from './app/Icons';
import { RatingMark } from './Rating';
import { Button } from './ui';

/* ---- Headings ----------------------------------------------------------- */

/**
 * The head of a top-level page: its name, an optional kicker above it, and
 * the page's own actions to the right.
 *
 * In the installed app the shell's title bar already names the screen, so the
 * title block is dropped there and only the actions remain — which is why the
 * actions belong in this component rather than beside it.
 */
export function PageHeader({
  title,
  kicker,
  actions,
  children,
  className,
}: {
  title: string;
  /** Small label above the title — the section a page belongs to. */
  kicker?: string;
  actions?: ReactNode;
  /** A line of supporting copy under the title. */
  children?: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <header
      className={cn(
        'mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3',
        !actions && 'app:hidden',
        className,
      )}
    >
      <div className="min-w-0 app:hidden">
        {kicker && (
          <p className="mb-1.5 font-cond text-[11px] font-bold uppercase tracking-[0.18em] text-muted-2">
            {kicker}
          </p>
        )}
        <h1 className="font-cond text-2xl font-extrabold uppercase leading-none tracking-[0.02em] sm:text-3xl">
          {title}
        </h1>
        {children && <div className="mt-2 max-w-[62ch] text-sm text-muted">{children}</div>}
      </div>
      {actions && <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/**
 * Shelf label: a condensed caps heading over a perforated rule, with an
 * optional count set as a machine record and a link or control to the right.
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
  right?: ReactNode;
}): JSX.Element {
  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2 pb-1.5">
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
              className="font-cond text-[11px] font-bold uppercase tracking-[0.14em] text-muted-2 hover:text-content"
            >
              {moreLabel}
            </Link>
          ) : null)}
      </div>
      <div className="rule-perf" />
    </div>
  );
}

/* ---- Posters ------------------------------------------------------------- */

/**
 * Where a title lives. Cached titles have a Cinelog id; provider hits that
 * nobody has opened yet don't, so they route through `/open`, which resolves
 * them and redirects — that keeps every poster a real link (middle-click, new
 * tab, copy address) instead of a button with a fetch behind it.
 */
export function mediaHref(
  m: { id?: string | null; provider?: string; externalId?: string; type?: MediaType },
  libraryOf?: string | null,
): string {
  if (m.id) {
    return `/media/${m.id}${libraryOf ? `?libraryOf=${encodeURIComponent(libraryOf)}` : ''}`;
  }
  const q = new URLSearchParams({
    provider: m.provider ?? '',
    externalId: m.externalId ?? '',
    type: m.type ?? 'MOVIE',
  });
  return `/open?${q.toString()}`;
}

function PosterArt({
  title,
  posterUrl,
  priority,
  showTitle = true,
}: {
  title: string;
  posterUrl?: string | null;
  priority?: boolean;
  showTitle?: boolean;
}): JSX.Element {
  return posterUrl ? (
    <img
      src={posterUrl}
      alt={title}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : undefined}
      className="h-full w-full object-cover"
    />
  ) : (
    <span className="absolute inset-0 block" style={{ background: posterGradient(title) }}>
      {showTitle && (
        <span className="absolute inset-x-1.5 bottom-2 block font-cond text-[13px] font-extrabold uppercase leading-tight text-white/95">
          {title}
        </span>
      )}
    </span>
  );
}

/**
 * The poster tile — the only one. Always a link. Artwork is the content, so
 * the tile stays flat and out of its way; what the archive adds is the
 * medium's stock label top-left and a like and a rating top-right. The title
 * lives in the tooltip and alt text: artwork first, text on demand.
 */
export function Poster({
  title,
  year,
  type,
  posterUrl,
  to,
  rating,
  ratingScale,
  ratingLabel,
  average = false,
  liked = false,
  priority = false,
  caption,
  className,
}: {
  title: string;
  year?: number | null;
  type?: MediaType;
  posterUrl?: string | null;
  /** Usually `mediaHref(item)`. */
  to: string;
  /** Normalized 0..100 — shown as the corner badge. */
  rating?: number | null;
  /** Omit to derive it from `type`, which is nearly always what you want. */
  ratingScale?: RatingScale;
  /** Tooltip naming whose rating this is. Defaults to the viewer's own. */
  ratingLabel?: string;
  /** The rating is an instance average, not anyone's own mark — plain ink. */
  average?: boolean;
  liked?: boolean;
  /** Above the fold: load eagerly at high priority instead of lazily. */
  priority?: boolean;
  /** A line under the tile (a role played, a list note). */
  caption?: ReactNode;
  className?: string;
}): JSX.Element {
  const label = year ? `${title} (${year})` : title;
  const hasRating = rating !== null && rating !== undefined;
  const queryClient = useQueryClient();
  // Intent (hover/focus): warm the detail chunk and its data before the click.
  const warm = (): void => {
    void loadMediaDetail();
    const id = /^\/media\/([^/?#]+)$/.exec(to)?.[1];
    if (id) void queryClient.prefetchQuery({ queryKey: ['media', id, null], queryFn: () => api.getMedia(id) });
  };
  return (
    <div className={cn('w-full min-w-0', className)}>
      <Link
        to={to}
        title={label}
        aria-label={label}
        onMouseEnter={warm}
        onFocus={warm}
        className="group block focus:outline-none"
      >
        <span
          className={cn(
            'relative block aspect-[2/3] w-full overflow-hidden rounded-sm bg-card',
            'ring-1 ring-border-hi/60 transition-[box-shadow] duration-150',
            'group-hover:ring-2 group-hover:ring-gold group-focus-visible:ring-2 group-focus-visible:ring-gold',
          )}
        >
          <PosterArt title={title} posterUrl={posterUrl} priority={priority} />
          {type && (
            <span className="absolute left-0 top-0 bg-bg-2/90 px-1.5 py-[3px] font-cond text-[11px] font-extrabold uppercase tracking-[0.12em] text-content/90">
              {TYPE_LABEL_SHORT[type]}
            </span>
          )}
          {(hasRating || liked) && (
            <span className="absolute right-0 top-0 flex items-stretch">
              {liked && (
                <span title="Liked" className="flex items-center bg-bg-2/95 px-1.5 text-rose">
                  <IconHeart filled className="h-3 w-3" />
                </span>
              )}
              {hasRating && (
                // The corner badge. A ten-point score carries its denominator
                // (RatingMark adds it) so a show never reads as comparable to
                // a film in a mixed grid.
                <span
                  title={ratingLabel ?? 'Your rating'}
                  className={cn(
                    'flex items-center px-1.5 py-1',
                    average ? 'bg-bg-2/95' : 'bg-gold',
                  )}
                >
                  <RatingMark
                    value={rating}
                    scale={ratingScale ?? scaleForMediaType(type ?? 'MOVIE')}
                    display="number"
                    average={average}
                    className={average ? undefined : '!text-ink'}
                  />
                </span>
              )}
            </span>
          )}
        </span>
      </Link>
      {caption && <div className="mt-1.5 truncate text-xs text-muted-2">{caption}</div>}
    </div>
  );
}

/**
 * A member's marks on a title, set under its poster (pass as `caption`): the
 * rating in the title's own scale, then like, rewatch and review. `watched`
 * adds the eye for a title seen but not rated.
 */
export function PosterMarks({
  type,
  rating,
  liked,
  rewatch,
  reviewId,
  watched,
}: {
  type: MediaType;
  rating?: number | null;
  liked?: boolean;
  rewatch?: boolean;
  /** Links the review mark to the review's own page. */
  reviewId?: string | null;
  watched?: boolean;
}): JSX.Element | null {
  const rated = rating !== null && rating !== undefined;
  if (!rated && !liked && !rewatch && !reviewId && !watched) return null;
  return (
    <span className="flex min-h-4 flex-wrap items-center gap-x-1.5 gap-y-1 text-muted-2">
      {rated ? (
        <RatingMark
          value={rating}
          type={type}
          size={11}
          display={isEpisodic(type) ? 'number' : 'stars'}
        />
      ) : (
        watched && (
          <span title="Watched" className="text-cyan">
            <IconEye className="h-3.5 w-3.5" />
          </span>
        )
      )}
      {liked && (
        <span title="Liked" className="text-rose">
          <IconHeart filled className="h-3 w-3" />
        </span>
      )}
      {rewatch && (
        <span title="Rewatch">
          <IconRewatch className="h-3 w-3" />
        </span>
      )}
      {reviewId && (
        <Link to={`/review/${reviewId}`} title="Read the review" className="hover:text-content">
          <IconReview className="h-3.5 w-3.5" />
        </Link>
      )}
    </span>
  );
}

const thumbSizes = {
  xs: 'h-14 w-10',
  sm: 'h-[66px] w-11',
  md: 'h-[72px] w-12',
  lg: 'h-24 w-16',
} as const;

/** A poster at row scale — diary rows, list entries, feed rows, pickers. No marks. */
export function PosterThumb({
  title,
  posterUrl,
  to,
  size = 'md',
  className,
}: {
  title: string;
  posterUrl?: string | null;
  /** Omit inside something that is already a control (a picker row). */
  to?: string;
  size?: keyof typeof thumbSizes;
  className?: string;
}): JSX.Element {
  const box = cn(
    'relative block shrink-0 overflow-hidden rounded-sm bg-card ring-1 ring-border-hi/60',
    thumbSizes[size],
    className,
  );
  const art = <PosterArt title={title} posterUrl={posterUrl} showTitle={false} />;
  return to ? (
    <Link
      to={to}
      title={title}
      aria-label={title}
      className={cn(
        box,
        'hover:ring-2 hover:ring-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold',
      )}
    >
      {art}
    </Link>
  ) : (
    <span className={box}>{art}</span>
  );
}

/**
 * The poster grid — the backbone of every browse surface. Three across on a
 * phone, opening to six; `dense` runs to eight for catalogue browsing, and
 * `four` is the fixed row a profile's favourites sit in.
 */
export function PosterGrid({
  children,
  variant = 'shelf',
  className,
}: {
  children: ReactNode;
  variant?: 'shelf' | 'dense' | 'four';
  className?: string;
}): JSX.Element {
  return (
    <div
      className={cn(
        'poster-grid grid gap-x-2.5 gap-y-4',
        variant === 'shelf' &&
          'grid-cols-3 sm:grid-cols-4 sm:gap-x-3.5 md:grid-cols-5 lg:grid-cols-6',
        variant === 'dense' && 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8',
        variant === 'four' && 'grid-cols-4',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Placeholder tiles for a grid that is still loading. */
export function PosterGridSkeleton({
  count = 18,
  variant,
}: {
  count?: number;
  variant?: 'shelf' | 'dense' | 'four';
}): JSX.Element {
  return (
    <PosterGrid variant={variant}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="aspect-[2/3] w-full animate-pulse rounded-sm bg-surface-2" />
      ))}
    </PosterGrid>
  );
}

/**
 * A horizontally scrolling poster rail with step arrows.
 *
 * Dragging a rail sideways is fine with a trackpad or a thumb and miserable
 * with a mouse, so each rail carries its own controls. They're hidden when
 * there's nothing further that way, which doubles as the signal for how much
 * rail is left. Children are sized by the rail — pass `Poster`s directly.
 */
export function PosterRail({ children }: { children: ReactNode }): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const measure = (): void => {
    const el = ref.current;
    if (!el) return;
    // A pixel of slack: fractional scroll widths otherwise leave the end arrow
    // showing on a rail that is already fully scrolled.
    setEdges({
      start: el.scrollLeft > 1,
      end: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    });
  };

  // Re-measure when the rail's contents or size change, not just on scroll:
  // posters arrive after the first paint, and a resize changes what fits.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [children]);

  const step = (direction: -1 | 1): void => {
    const el = ref.current;
    // Just under a full pane, so the poster at the edge stays as an anchor.
    el?.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: 'smooth' });
  };

  return (
    <div className="group/rail relative">
      <div
        ref={ref}
        onScroll={measure}
        /* Bleed past the page gutter on phones, so the edge fade lands at the
           screen edge rather than on a poster's face. */
        className="rail-mask -mx-4 overflow-x-auto px-4 pb-2 pt-1 scrollbar-none sm:-mx-2 sm:px-2"
      >
        <div className="flex w-max gap-2.5 [&>*]:w-[112px] [&>*]:shrink-0 sm:gap-3.5 sm:[&>*]:w-[150px]">
          {children}
        </div>
      </div>
      {(['start', 'end'] as const).map(
        (side) =>
          edges[side] && (
            <Button
              key={side}
              size="icon"
              onClick={() => step(side === 'start' ? -1 : 1)}
              aria-label={side === 'start' ? 'Scroll left' : 'Scroll right'}
              className={cn(
                'absolute top-1/2 z-10 hidden -translate-y-1/2 !bg-bg-2 opacity-0 shadow-soft',
                'focus-visible:opacity-100 group-hover/rail:opacity-100 sm:inline-flex',
                side === 'start' ? '-left-1' : '-right-1',
              )}
            >
              {side === 'start' ? <IconChevronLeft className="h-4 w-4" /> : <IconChevronRight />}
            </Button>
          ),
      )}
    </div>
  );
}

/* ---- Data ---------------------------------------------------------------- */

/**
 * A date, typewritten. `dateOnly` for watch dates (stored at 12:00 UTC), so
 * they're read as calendar dates and never shift a day; bare `YYYY-MM-DD`
 * strings are treated that way automatically.
 */
export function DateText({
  iso,
  dateOnly,
  className,
}: {
  iso: string;
  dateOnly?: boolean;
  className?: string;
}): JSX.Element {
  return (
    <time dateTime={iso} className={cn('font-data text-[11px] text-muted-2', className)}>
      {formatDate(iso, { dateOnly })}
    </time>
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

/** A classification chip — a genre, a tally. Cut corners, never a pill. */
export function Tag({ children, count }: { children: ReactNode; count?: number }): JSX.Element {
  return (
    <span className="inline-flex items-baseline gap-1.5 rounded-sm border border-border-hi bg-surface-2 px-2 py-1 font-cond text-[11px] font-bold uppercase tracking-[0.1em] text-muted">
      {children}
      {count != null && (
        <span className="font-data font-normal tracking-normal text-muted-2">{count}</span>
      )}
    </span>
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

/* ---- Tabs ---------------------------------------------------------------- */

export interface TabItem {
  key: string;
  label: string;
  count?: number;
  /** Makes the tab a link (routed tabs, the app shell's strips). */
  to?: string;
}

/**
 * Index-tab bar: condensed caps, counts typewritten, active tab ruled in ink.
 * Scrolls sideways when it's wider than the screen and keeps the active tab
 * in view. Tabs are buttons calling `onChange`, or links when they carry `to`.
 */
export function TabBar({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: TabItem[];
  active: string;
  onChange?: (key: string) => void;
  className?: string;
}): JSX.Element {
  const bar = useRef<HTMLDivElement>(null);

  // Scroll the strip itself, never the page: `scrollIntoView` would also drag
  // a tab bar that sits below the fold up into view on mount.
  useLayoutEffect(() => {
    const c = bar.current;
    const el = c?.querySelector<HTMLElement>('[data-active="true"]');
    if (!c || !el) return;
    const pad = 24;
    if (el.offsetLeft - pad < c.scrollLeft) c.scrollLeft = el.offsetLeft - pad;
    else if (el.offsetLeft + el.offsetWidth + pad > c.scrollLeft + c.clientWidth) {
      c.scrollLeft = el.offsetLeft + el.offsetWidth + pad - c.clientWidth;
    }
  }, [active, tabs.length]);

  return (
    <div
      ref={bar}
      role={onChange ? 'tablist' : undefined}
      className={cn(
        'relative flex gap-0.5 overflow-x-auto border-b border-border scrollbar-none',
        className,
      )}
    >
      {tabs.map((t) => {
        const on = active === t.key;
        const cls = cn(
          'shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 coarse:py-3',
          'font-cond text-[13px] font-bold uppercase tracking-[0.13em]',
          'focus:outline-none focus-visible:text-content focus-visible:underline',
          on ? 'border-gold text-content' : 'border-transparent text-muted hover:text-content',
        );
        const inner = (
          <>
            {t.label}
            {t.count != null && (
              <span className="ml-1.5 font-data text-[11px] font-normal tracking-normal text-muted-2">
                {t.count}
              </span>
            )}
          </>
        );
        return t.to ? (
          <Link
            key={t.key}
            to={t.to}
            data-active={on}
            aria-current={on ? 'page' : undefined}
            className={cls}
          >
            {inner}
          </Link>
        ) : (
          <button
            key={t.key}
            type="button"
            role="tab"
            data-active={on}
            aria-selected={on}
            onClick={() => onChange?.(t.key)}
            className={cls}
          >
            {inner}
          </button>
        );
      })}
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

/** Standalone works rate out of five; everything episodic out of ten. */
export function isEpisodic(type: MediaType): boolean {
  return type !== 'MOVIE' && type !== 'SPECIAL';
}

/* ---- Empty & error states -------------------------------------------------- */

/**
 * An empty shelf: ruled card stock with the reason typed onto it. `compact`
 * for a tab or panel, where a full-height card would shout.
 */
export function EmptyState({
  title,
  body,
  action,
  compact = false,
  className,
}: {
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}): JSX.Element {
  return (
    <div
      className={cn(
        'rounded-sm border border-dashed border-border-hi bg-surface/40 px-6 text-center',
        compact ? 'py-7' : 'py-14',
        className,
      )}
    >
      <p
        className={cn(
          'font-cond font-extrabold uppercase tracking-[0.06em] text-content',
          compact ? 'text-[15px]' : 'text-lg',
        )}
      >
        {title}
      </p>
      {body && <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">{body}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

/**
 * Something failed to load. The same card as an empty shelf, ruled in the
 * system's verdigris and offering a retry — never stamp red, which means
 * affection here.
 */
export function ErrorState({
  title = "Couldn't load this",
  body = 'Something went wrong fetching it.',
  onRetry,
  action,
  compact,
}: {
  title?: string;
  body?: ReactNode;
  onRetry?: () => void;
  /** Extra actions beside the retry. */
  action?: ReactNode;
  compact?: boolean;
}): JSX.Element {
  return (
    <div role="alert">
      <EmptyState
        title={title}
        body={body}
        compact={compact}
        className="border-cyan/50"
        action={
          onRetry || action ? (
            <>
              {action}
              {onRetry && <Button onClick={onRetry}>Try again</Button>}
            </>
          ) : undefined
        }
      />
    </div>
  );
}
