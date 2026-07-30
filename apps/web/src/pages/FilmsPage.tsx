import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { BROWSE_GENRES, type BrowseSort, type DiscoverFilterItem } from '@cinelog/contracts';
import { api } from '../lib/api';
import { cn } from '../lib/cn';
import { EmptyState, Poster, PosterGrid, SectionHeader } from '../components/lb';
import { Button, Spinner } from '../components/ui';

type BrowseType = 'MOVIE' | 'TV';
type Source = 'PROVIDER' | 'CINELOG';

const SORTS: { value: BrowseSort; label: string }[] = [
  { value: 'POPULARITY', label: 'Popularity' },
  { value: 'RATING', label: 'Highest rated' },
  { value: 'CINELOG_RATING', label: 'Cinelog rating' },
  { value: 'RELEASE_DATE', label: 'Release date' },
  { value: 'TITLE', label: 'Name' },
];

function decades(): number[] {
  const now = Math.floor(new Date().getFullYear() / 10) * 10;
  const out: number[] = [];
  for (let d = now; d >= 1900; d -= 10) out.push(d);
  return out;
}

interface Filters {
  type: BrowseType;
  source: Source;
  genre: string;
  decade: number | '';
  minRating: number | '';
  sort: BrowseSort;
}

const DEFAULTS: Filters = {
  type: 'MOVIE',
  source: 'PROVIDER',
  genre: '',
  decade: '',
  minRating: '',
  sort: 'POPULARITY',
};

export function FilmsPage(): JSX.Element {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Filters>(DEFAULTS);
  const [page, setPage] = useState(1);
  const [opening, setOpening] = useState(false);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['browse', filters, page],
    queryFn: () =>
      api.browse({
        type: filters.type,
        source: filters.source,
        genre: filters.genre || undefined,
        decade: filters.decade || undefined,
        minRating: filters.minRating || undefined,
        sort: filters.sort,
        page,
      }),
    // Keeps the previous grid on screen while the next page loads, so paging
    // doesn't collapse the layout to a spinner and back.
    placeholderData: keepPreviousData,
  });

  function update(next: Partial<Filters>): void {
    setFilters((f) => ({ ...f, ...next }));
    setPage(1);
  }

  /** Provider results aren't cached locally yet, so resolve on open. */
  async function open(item: DiscoverFilterItem): Promise<void> {
    if (item.id) {
      navigate(`/media/${item.id}`);
      return;
    }
    setOpening(true);
    try {
      const detail = await api.resolveMedia({
        provider: item.provider,
        externalId: item.externalId,
        type: item.type,
      });
      navigate(`/media/${detail.id}`);
    } finally {
      setOpening(false);
    }
  }

  const items = data?.items ?? [];
  const heading =
    filters.source === 'CINELOG'
      ? `Rated on Cinelog`
      : filters.sort === 'POPULARITY'
        ? `Popular ${filters.type === 'TV' ? 'shows' : 'films'}`
        : `Browse ${filters.type === 'TV' ? 'shows' : 'films'}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <SectionHeader
        title={heading}
        right={
          isFetching ? <Spinner className="h-4 w-4" /> : undefined
        }
      />

      <FilterBar filters={filters} onChange={update} />

      {opening && (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      )}

      <div className="mt-6">
        {isLoading ? (
          <PosterGrid>
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] w-full animate-pulse rounded-[3px] bg-surface-2" />
            ))}
          </PosterGrid>
        ) : isError ? (
          <EmptyState
            title="Couldn't load films"
            body="The metadata provider didn't respond. Check that TMDB is configured, then try again."
            action={
              <Button variant="secondary" onClick={() => void refetch()}>
                Try again
              </Button>
            }
          />
        ) : items.length === 0 ? (
          <EmptyState
            title="Nothing matches these filters"
            body={
              filters.source === 'CINELOG'
                ? 'No one on this instance has rated a title matching these filters yet.'
                : 'Try widening the decade, genre, or rating filters.'
            }
            action={
              <Button variant="secondary" onClick={() => update(DEFAULTS)}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <>
            <PosterGrid>
              {items.map((item) => (
                <Poster
                  key={`${item.provider}:${item.externalId}`}
                  title={item.title}
                  posterUrl={item.posterUrl}
                  type={item.type}
                  rating={item.ratingCount > 0 ? item.communityRating : null}
                  ratingLabel="Average rating on this instance"
                  onClick={() => void open(item)}
                />
              ))}
            </PosterGrid>

            <div className="mt-8 flex items-center justify-center gap-3">
              <Button
                variant="secondary"
                disabled={page === 1 || isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Previous
              </Button>
              <span className="font-cond text-[13px] font-bold uppercase tracking-wide tabular-nums text-muted">
                Page {page}
              </span>
              <Button
                variant="secondary"
                disabled={!data?.hasMore || isFetching}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FilterBar({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (next: Partial<Filters>) => void;
}): JSX.Element {
  const select =
    'h-9 rounded border border-border bg-surface-2 px-2.5 font-cond text-[13px] font-bold uppercase tracking-wide text-content focus:border-transparent focus:outline-none focus:ring-2 focus:ring-cyan/50';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="mr-1 flex rounded border border-border bg-surface p-0.5">
        {(['MOVIE', 'TV'] as BrowseType[]).map((t) => (
          <button
            key={t}
            onClick={() => onChange({ type: t, genre: '' })}
            className={cn(
              'rounded px-3 py-1.5 font-cond text-[13px] font-bold uppercase tracking-wide transition-colors',
              filters.type === t ? 'bg-gold text-ink' : 'text-muted hover:text-content',
            )}
          >
            {t === 'MOVIE' ? 'Films' : 'Shows'}
          </button>
        ))}
      </div>

      <select
        value={filters.genre}
        onChange={(e) => onChange({ genre: e.target.value })}
        className={select}
        aria-label="Genre"
      >
        <option value="">All genres</option>
        {BROWSE_GENRES.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </select>

      <select
        value={filters.decade}
        onChange={(e) => onChange({ decade: e.target.value ? Number(e.target.value) : '' })}
        className={select}
        aria-label="Decade"
      >
        <option value="">Any decade</option>
        {decades().map((d) => (
          <option key={d} value={d}>
            {d}s
          </option>
        ))}
      </select>

      <select
        value={filters.minRating}
        onChange={(e) => onChange({ minRating: e.target.value ? Number(e.target.value) : '' })}
        className={select}
        aria-label="Minimum rating"
      >
        <option value="">Any rating</option>
        <option value="60">★★★ and up</option>
        <option value="70">★★★½ and up</option>
        <option value="80">★★★★ and up</option>
      </select>

      <select
        value={filters.sort}
        onChange={(e) => onChange({ sort: e.target.value as BrowseSort })}
        className={select}
        aria-label="Sort by"
      >
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            Sort: {s.label}
          </option>
        ))}
      </select>

      <button
        onClick={() =>
          onChange({ source: filters.source === 'CINELOG' ? 'PROVIDER' : 'CINELOG' })
        }
        title="Restrict to titles rated by members of this Cinelog instance"
        className={cn(
          'h-9 rounded border px-3 font-cond text-[13px] font-bold uppercase tracking-wide transition-colors',
          filters.source === 'CINELOG'
            ? 'border-gold bg-gold/15 text-gold'
            : 'border-border bg-surface-2 text-muted hover:text-content',
        )}
      >
        Cinelog only
      </button>
    </div>
  );
}
