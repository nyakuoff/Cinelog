import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  fromNormalized,
  scaleForMediaType,
  type LibraryItem,
  type MediaDetail,
  type MediaType,
  type TrackingStatus,
} from '@cinelog/contracts';
import { api } from '../lib/api';
import { useCountUp } from '../lib/useCountUp';
import { cn } from '../lib/cn';
import { posterGradient } from '../lib/poster';
import { PosterCard } from '../components/PosterCard';
import { Stars } from '../components/Stars';
import { Button, Spinner } from '../components/ui';

type Filter = 'all' | 'WATCHING' | 'COMPLETED' | 'ON_HOLD' | 'DROPPED';

// The watchlist (Plan to Watch) lives on its own /watchlist page, Letterboxd-
// style — the home library is only things you've actually started/finished.
const TABS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'WATCHING', label: 'Watching' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'ON_HOLD', label: 'On Hold' },
  { key: 'DROPPED', label: 'Dropped' },
];

function matches(item: LibraryItem, f: Filter): boolean {
  if (f === 'all') return true;
  return item.status === f;
}

// Films vs. Shows: same split used for rating scales (movies/specials are
// standalone works; everything else is episodic), so the two groupings agree.
type Group = 'FILMS' | 'SHOWS';
const GROUPS: { key: Group; label: string }[] = [
  { key: 'FILMS', label: 'Films' },
  { key: 'SHOWS', label: 'Shows' },
];
function groupOf(type: MediaType): Group {
  return type === 'MOVIE' || type === 'SPECIAL' ? 'FILMS' : 'SHOWS';
}

export function HomePage(): JSX.Element {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');
  const [group, setGroup] = useState<Group>('FILMS');

  const { data, isLoading } = useQuery({ queryKey: ['library'], queryFn: () => api.getLibrary() });
  const items = data?.items ?? [];

  // The home library excludes the watchlist — that has its own page.
  const libraryItems = useMemo(
    () => items.filter((i) => i.status !== 'PLAN_TO_WATCH'),
    [items],
  );

  // Feature the highest-rated title in the watched library (not scoped to the
  // selected Films/Shows tab — this is a highlight of everything you've seen).
  const featured = useMemo(() => {
    if (libraryItems.length === 0) return null;
    const rated = [...libraryItems].filter((i) => i.rating !== null);
    if (rated.length) return rated.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0]!;
    return libraryItems[0]!;
  }, [libraryItems]);

  const groupItems = libraryItems.filter((i) => groupOf(i.type) === group);
  const filtered = groupItems.filter((i) => matches(i, filter));
  const groupCounts: Record<Group, number> = {
    FILMS: libraryItems.filter((i) => groupOf(i.type) === 'FILMS').length,
    SHOWS: libraryItems.filter((i) => groupOf(i.type) === 'SHOWS').length,
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-32">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  if (items.length === 0) return <WelcomeHero onSearch={() => navigate('/search')} />;

  return (
    <>
      {featured && <FeaturedHero item={featured} onOpen={(id) => navigate(`/media/${id}`)} />}

      <StatsStrip items={items} />

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Library */}
        <section className="pt-10">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-border pb-4">
            <div className="flex flex-wrap items-baseline gap-4">
              <h2 className="font-cond text-[15px] font-extrabold uppercase tracking-[0.08em] text-muted">
                Your library
              </h2>
              <div className="flex gap-1 rounded-xl border border-border bg-surface p-1">
                {GROUPS.map((g) => (
                  <button
                    key={g.key}
                    onClick={() => setGroup(g.key)}
                    className={cn(
                      'rounded-lg px-3.5 py-1.5 font-cond text-[13px] font-bold uppercase tracking-wide transition-colors',
                      group === g.key ? 'bg-gold text-ink' : 'text-muted hover:text-content',
                    )}
                  >
                    {g.label}
                    <span className={cn('ml-1.5 tabular-nums', group === g.key ? 'text-ink/70' : 'text-muted-2')}>
                      {groupCounts[g.key]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-1 rounded-xl border border-border bg-surface p-1">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setFilter(t.key)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 font-cond text-[13px] font-bold uppercase tracking-wide transition-colors',
                    filter === t.key ? 'bg-surface-2 text-content' : 'text-muted hover:text-content',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="py-10 text-center text-muted">
              {groupItems.length === 0
                ? `No ${group === 'FILMS' ? 'films' : 'shows'} in your library yet.`
                : 'Nothing in this view yet.'}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {filtered.map((item, i) => (
                <PosterCard
                  key={item.id}
                  title={item.title}
                  year={item.year}
                  type={item.type}
                  posterUrl={item.posterUrl}
                  rating={item.rating}
                  ratingScale={scaleForMediaType(item.type)}
                  liked={item.isFavorite}
                  index={i}
                  onClick={() => navigate(`/media/${item.id}`)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
      <div className="h-16" />
    </>
  );
}

// --------------------------------------------------------------------------

function FeaturedHero({
  item,
  onOpen,
}: {
  item: LibraryItem;
  onOpen: (id: string) => void;
}): JSX.Element {
  const scale = scaleForMediaType(item.type);
  // Pull backdrop + synopsis for a proper hero.
  const { data } = useQuery<MediaDetail>({
    queryKey: ['media', item.id],
    queryFn: () => api.getMedia(item.id),
  });
  const backdrop = data?.backdropUrl ?? null;

  return (
    <section className="relative flex min-h-[62vh] items-end overflow-hidden">
      <div className="absolute inset-0">
        {backdrop ? (
          <img src={backdrop} alt="" className="h-full w-full animate-kenburns object-cover" />
        ) : (
          <div className="h-full w-full animate-kenburns" style={{ background: posterGradient(item.title) }} />
        )}
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/75 to-bg/10" />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/25 to-transparent" />

      <div className="relative mx-auto w-full max-w-6xl px-4 pb-12 pt-40 sm:px-6">
        <p className="mb-3 inline-flex items-center gap-2.5 font-cond text-xs font-extrabold uppercase tracking-[0.2em] text-gold">
          <span className="h-0.5 w-6 bg-gold" />
          {item.rating !== null ? 'Your top-rated' : 'Continue watching'}
        </p>
        <h1 className="max-w-2xl font-cond text-5xl font-extrabold uppercase leading-[0.95] tracking-tight text-content text-balance sm:text-6xl">
          {item.title}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
          {item.year && <span className="tabular-nums">{item.year}</span>}
          {data?.runtime && <span>· {formatRuntime(data.runtime)}</span>}
          {data && data.genres.length > 0 && <span>· {data.genres.slice(0, 3).map((g) => g.name).join(' · ')}</span>}
          {item.rating !== null && (
            <span className="flex items-center gap-2">
              · <Stars value={item.rating} size={16} />
              <span className="font-semibold tabular-nums text-gold">{fromNormalized(item.rating, scale)}</span>
            </span>
          )}
        </div>
        {data?.overview && (
          <p className="mt-4 max-w-[54ch] leading-relaxed text-content/85 line-clamp-3">
            {data.overview}
          </p>
        )}
        <div className="mt-6">
          <Button variant="primary" size="lg" onClick={() => onOpen(item.id)}>
            ▶ Open details
          </Button>
        </div>
      </div>
    </section>
  );
}

function WelcomeHero({ onSearch }: { onSearch: () => void }): JSX.Element {
  const tiles = ['Dune', 'Shogun', 'Frieren', 'Oppenheimer', 'Arcane', 'Poor Things'];
  return (
    <section className="relative flex min-h-[80vh] items-center overflow-hidden">
      <div
        className="absolute -inset-16 grid grid-cols-6 gap-3 opacity-20"
        style={{ transform: 'rotate(-8deg) scale(1.2)' }}
        aria-hidden="true"
      >
        {[...tiles, ...tiles, ...tiles].map((t, i) => (
          <div key={i} className="aspect-[2/3] rounded-md animate-fadeup" style={{ background: posterGradient(t + i), animationDelay: `${i * 40}ms` }} />
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/85 to-bg/60" />
      <div className="relative mx-auto max-w-2xl px-6 text-center">
        <p className="mb-3 font-cond text-xs font-extrabold uppercase tracking-[0.24em] text-gold">
          Your cinema starts here
        </p>
        <h1 className="font-cond text-5xl font-extrabold uppercase leading-[0.95] tracking-tight text-content text-balance sm:text-6xl">
          Log the first thing you watched
        </h1>
        <p className="mx-auto mt-4 max-w-md text-muted">
          Search any film, series, anime, or documentary to add it to your library, rate it, and
          start tracking.
        </p>
        <div className="mt-7 flex justify-center">
          <Button variant="primary" size="lg" onClick={onSearch}>
            ⌕ Search something to log
          </Button>
        </div>
      </div>
    </section>
  );
}

function StatsStrip({ items }: { items: LibraryItem[] }): JSX.Element {
  const watched = items.filter((i) => i.status === 'COMPLETED').length;
  const watchlist = items.filter((i) => i.status === 'PLAN_TO_WATCH').length;
  const ratedItems = items.filter((i) => i.rating !== null);
  // Ratings live on different scales per type; average in normalized space and
  // show it out of 10 as a common denominator.
  const avg =
    ratedItems.length > 0
      ? ratedItems.reduce((s, i) => s + (i.rating ?? 0), 0) / ratedItems.length
      : null;

  return (
    <div className="border-y border-border bg-bg-2">
      <div className="mx-auto grid max-w-6xl grid-cols-2 sm:grid-cols-4">
        <Stat n={watched} label="Watched" />
        <Stat n={watchlist} label="Watchlist" to="/watchlist" />
        <Stat n={ratedItems.length} label="Rated" />
        <Stat label="Avg / 10" text={avg !== null ? (avg / 10).toFixed(1) : '—'} />
      </div>
    </div>
  );
}

function Stat({
  n,
  label,
  text,
  to,
}: {
  n?: number;
  label: string;
  text?: string;
  to?: string;
}): JSX.Element {
  const counted = useCountUp(n ?? 0);
  const cellClass =
    'border-r border-border px-4 py-5 text-center last:border-r-0 sm:[&:nth-child(2)]:border-r';
  const inner = (
    <>
      <div className="font-cond text-3xl font-extrabold tabular-nums text-content sm:text-4xl">
        {text ?? counted.toLocaleString()}
      </div>
      <div className="mt-0.5 font-cond text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
        {label}
      </div>
    </>
  );
  // The Watchlist stat is a shortcut into the dedicated watchlist page.
  return to ? (
    <Link to={to} className={cn(cellClass, 'block transition-colors hover:bg-surface')}>
      {inner}
    </Link>
  ) : (
    <div className={cellClass}>{inner}</div>
  );
}

function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
