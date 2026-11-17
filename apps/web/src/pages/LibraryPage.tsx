import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { type LibraryItem, type MediaDetail } from '@cinelog/contracts';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useCountUp } from '../lib/useCountUp';
import { cn } from '../lib/cn';
import { posterGradient } from '../lib/poster';
import { sortLibrary, type SortKey } from '../lib/sortLibrary';
import { SortSelect } from '../components/SortSelect';
import { RatingMark } from '../components/Rating';
import {
  EmptyState,
  formatRuntime,
  isEpisodic,
  mediaHref,
  PageHeader,
  Poster,
  PosterGrid,
} from '../components/lb';
import { buttonClass, Segmented, Spinner } from '../components/ui';

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

// Films vs. Shows: the same split the rating scales use (standalone works vs.
// everything episodic), so the two groupings agree.
type Group = 'FILMS' | 'SHOWS';
const groupOf = (item: LibraryItem): Group => (isEpisodic(item.type) ? 'SHOWS' : 'FILMS');

export function LibraryPage(): JSX.Element {
  const { user } = useAuth();
  // Links carry whose library view this is, which is what makes artwork
  // editable here and nowhere else.
  const mine = user?.username;
  const [filter, setFilter] = useState<Filter>('all');
  const [group, setGroup] = useState<Group>('FILMS');
  const [sort, setSort] = useState<SortKey>('added');

  const { data, isLoading } = useQuery({ queryKey: ['library'], queryFn: () => api.getLibrary() });
  const items = useMemo(() => data?.items ?? [], [data]);

  // The library excludes the watchlist — that has its own page.
  const libraryItems = useMemo(
    // Watchlisted-but-untracked titles belong to the watchlist, not the library.
    () => items.filter((i) => i.status !== null || !i.isWatchlisted),
    [items],
  );

  // Feature the highest-rated title in the library (not scoped to the selected
  // Films/Shows view — this is a highlight of everything you've seen).
  const featured = useMemo(() => {
    if (libraryItems.length === 0) return null;
    const rated = [...libraryItems].filter((i) => i.rating !== null);
    if (rated.length) return rated.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0]!;
    return libraryItems[0]!;
  }, [libraryItems]);

  const filtered = useMemo(
    () =>
      sortLibrary(
        libraryItems.filter((i) => groupOf(i) === group && matches(i, filter)),
        sort,
      ),
    [libraryItems, group, filter, sort],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const i of libraryItems) c[groupOf(i)] = (c[groupOf(i)] ?? 0) + 1;
    return c;
  }, [libraryItems]);
  const count = (g: Group): number => counts[g] ?? 0;

  if (isLoading) return <Spinner center />;

  if (items.length === 0) return <WelcomeHero />;

  return (
    <>
      {featured && <FeaturedHero item={featured} to={mediaHref(featured, mine)} />}

      <StatsStrip items={items} />

      <div className="mx-auto max-w-6xl px-4 pb-16 pt-10 app:pt-4 sm:px-6">
        <PageHeader
          title="Library"
          actions={
            <>
              <Segmented
                label="Films or shows"
                value={group}
                onChange={setGroup}
                options={[
                  { value: 'FILMS', label: 'Films', count: count('FILMS') },
                  { value: 'SHOWS', label: 'Shows', count: count('SHOWS') },
                ]}
              />
              <Segmented
                label="Status"
                value={filter}
                onChange={setFilter}
                options={TABS.map((t) => ({ value: t.key, label: t.label }))}
              />
              <SortSelect value={sort} onChange={setSort} />
            </>
          }
        />

        {filtered.length === 0 ? (
          <EmptyState
            compact
            title={
              count(group) === 0
                ? `No ${group === 'FILMS' ? 'films' : 'shows'} in your library yet`
                : 'Nothing in this view yet'
            }
          />
        ) : (
          <PosterGrid>
            {filtered.map((item) => (
              <Poster
                key={item.id}
                title={item.title}
                year={item.year}
                type={item.type}
                posterUrl={item.posterUrl}
                rating={item.rating}
                liked={item.isFavorite}
                to={mediaHref(item, mine)}
              />
            ))}
          </PosterGrid>
        )}
      </div>
    </>
  );
}

// --------------------------------------------------------------------------

function FeaturedHero({ item, to }: { item: LibraryItem; to: string }): JSX.Element {
  // Pull backdrop + synopsis for a proper hero.
  const { data } = useQuery<MediaDetail>({
    queryKey: ['media', item.id],
    queryFn: () => api.getMedia(item.id),
  });
  const backdrop = data?.backdropUrl ?? null;

  return (
    /* On the website this is a tall banner. In the installed app it's the top
       of a phone screen you came to for the grid below, so it drops to a short
       strip: no viewport-height floor, a title that fits, no synopsis. */
    <section className="relative flex min-h-[62vh] items-end overflow-hidden app:min-h-0">
      <div className="absolute inset-0">
        {backdrop ? (
          <img
            src={backdrop}
            alt=""
            decoding="async"
            fetchPriority="high"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full" style={{ background: posterGradient(item.title) }} />
        )}
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/75 to-bg/10" />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/25 to-transparent" />

      <div className="relative mx-auto w-full max-w-6xl px-4 pb-12 pt-40 app:pb-5 app:pt-20 sm:px-6">
        <p className="mb-3 font-cond text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted app:mb-2">
          {item.rating !== null ? 'Your top-rated' : 'Continue watching'}
        </p>
        <h2 className="max-w-2xl text-balance font-cond text-5xl font-extrabold uppercase leading-[0.95] tracking-tight text-content app:text-[27px] sm:text-6xl">
          {item.title}
        </h2>
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 font-data text-[13px] text-muted app:mt-2.5">
          {item.year && <span>{item.year}</span>}
          {data?.runtime && <span>· {formatRuntime(data.runtime)}</span>}
          {data && data.genres.length > 0 && (
            <span className="font-sans text-sm app:hidden">
              ·{' '}
              {data.genres
                .slice(0, 3)
                .map((g) => g.name)
                .join(' · ')}
            </span>
          )}
          {item.rating !== null && <RatingMark value={item.rating} type={item.type} size={15} />}
        </div>
        {data?.overview && (
          <p className="mt-4 line-clamp-3 max-w-[54ch] leading-relaxed text-content/85 app:hidden">
            {data.overview}
          </p>
        )}
        <div className="mt-6 app:mt-4">
          <Link to={to} className={buttonClass({ variant: 'secondary' })}>
            Open title
          </Link>
        </div>
      </div>
    </section>
  );
}

function WelcomeHero(): JSX.Element {
  const tiles = ['Dune', 'Shogun', 'Frieren', 'Oppenheimer', 'Arcane', 'Poor Things'];
  return (
    <section className="relative flex min-h-[80vh] items-center overflow-hidden app:min-h-[70dvh]">
      <div
        className="absolute -inset-16 grid grid-cols-6 gap-3 opacity-20"
        style={{ transform: 'rotate(-8deg) scale(1.2)' }}
        aria-hidden="true"
      >
        {[...tiles, ...tiles, ...tiles].map((t, i) => (
          <div
            key={i}
            className="aspect-[2/3] rounded-sm"
            style={{ background: posterGradient(t + i) }}
          />
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/85 to-bg/60" />
      <div className="relative mx-auto max-w-2xl px-6 text-center">
        <p className="mb-3 font-cond text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted">
          Your library starts here
        </p>
        <h1 className="text-balance font-cond text-5xl font-extrabold uppercase leading-[0.95] tracking-tight text-content app:text-3xl sm:text-6xl">
          Log the first thing you watched
        </h1>
        <p className="mx-auto mt-4 max-w-md text-muted">
          Search any film, show, anime, or documentary to add it to your library, rate it, and start
          tracking.
        </p>
        <div className="mt-7 flex justify-center">
          <Link to="/search" className={buttonClass({ variant: 'primary' })}>
            Find a title to log
          </Link>
        </div>
      </div>
    </section>
  );
}

function StatsStrip({ items }: { items: LibraryItem[] }): JSX.Element {
  const watched = items.filter((i) => i.status === 'COMPLETED').length;
  const watchlist = items.filter((i) => i.isWatchlisted).length;
  const ratedItems = items.filter((i) => i.rating !== null);
  // Ratings live on different scales per type; average in normalized space and
  // show it on the ten scale as a common denominator.
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
        <Stat label="Average rating">
          {avg !== null ? (
            <RatingMark value={avg} scale="TEN_HALF" display="number" average size={28} />
          ) : (
            '—'
          )}
        </Stat>
      </div>
    </div>
  );
}

function Stat({
  n,
  label,
  children,
  to,
}: {
  n?: number;
  label: string;
  /** Replaces the counted number (for a stat that isn't a tally). */
  children?: React.ReactNode;
  to?: string;
}): JSX.Element {
  const counted = useCountUp(n ?? 0);
  const cellClass =
    'border-r border-border px-4 py-5 text-center last:border-r-0 sm:[&:nth-child(2)]:border-r';
  const inner = (
    <>
      <div className="flex h-10 items-center justify-center font-data text-3xl font-bold text-content sm:text-4xl">
        {children ?? counted.toLocaleString()}
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
