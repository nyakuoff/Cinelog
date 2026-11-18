import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { BROWSE_GENRES, type BrowseSort } from '@cinelog/contracts';
import { api } from '../lib/api';
import { decadeOptions, MIN_RATING_OPTIONS } from '../lib/format';
import {
  EmptyState,
  ErrorState,
  mediaHref,
  PageHeader,
  Poster,
  PosterGrid,
  PosterGridSkeleton,
} from '../components/lb';
import { Button, Segmented, Select, Spinner } from '../components/ui';

type BrowseType = 'MOVIE' | 'TV';

const SORTS: { value: BrowseSort; label: string }[] = [
  { value: 'POPULARITY', label: 'Popularity' },
  { value: 'RATING', label: 'Highest rated' },
  { value: 'CINELOG_RATING', label: 'Cinelog rating' },
  { value: 'RELEASE_DATE', label: 'Release date' },
  { value: 'TITLE', label: 'Name' },
];

interface Filters {
  type: BrowseType;
  genre: string;
  decade: number | '';
  minRating: number | '';
  sort: BrowseSort;
}

const DEFAULTS: Filters = {
  type: 'MOVIE',
  genre: '',
  decade: '',
  minRating: '',
  sort: 'POPULARITY',
};

/**
 * Media (`/films`): the provider catalogue, browsable as films or shows. The
 * filters and page live in the URL (`?type=TV&genre=Drama&decade=1990`), so a
 * genre on a title's page can link straight to its shelf and Back restores it.
 */
export function FilmsPage(): JSX.Element {
  const [params, setParams] = useSearchParams();
  const filters: Filters = {
    type: params.get('type') === 'TV' ? 'TV' : 'MOVIE',
    genre: params.get('genre') ?? '',
    decade: Number(params.get('decade')) || '',
    minRating: Number(params.get('minRating')) || '',
    sort: SORTS.find((o) => o.value === params.get('sort'))?.value ?? 'POPULARITY',
  };
  const page = Math.max(1, Number(params.get('page')) || 1);

  /** Write the changed values into the URL, dropping any that are defaults. */
  function write(next: Partial<Filters> & { page?: number }): void {
    const merged = { ...filters, page: 1, ...next };
    const out = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (v !== '' && v !== (k === 'page' ? 1 : DEFAULTS[k as keyof Filters]))
        out.set(k, String(v));
    }
    setParams(out, { replace: true });
  }
  const update = (next: Partial<Filters>): void => write(next);
  const setPage = (p: number): void => write({ page: p });

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['browse', filters, page],
    staleTime: 10 * 60_000,
    queryFn: () =>
      api.browse({
        type: filters.type,
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

  const items = data?.items ?? [];
  const noun = filters.type === 'TV' ? 'shows' : 'films';

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 app:py-4 sm:px-6">
      <PageHeader title="Media" />

      <FilterBar filters={filters} onChange={update} busy={isFetching && !isLoading} />

      <div className="mt-6">
        {isLoading ? (
          <PosterGridSkeleton count={24} variant="dense" />
        ) : isError ? (
          <ErrorState
            title={`Couldn't load ${noun}`}
            body="The metadata provider didn't respond. Check that TMDB is configured, then try again."
            onRetry={() => void refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            title="Nothing matches these filters"
            body="Try widening the decade, genre, or rating filters."
            action={<Button onClick={() => update(DEFAULTS)}>Clear filters</Button>}
          />
        ) : (
          <>
            <PosterGrid variant="dense">
              {items.map((item) => (
                <Poster
                  key={`${item.provider}:${item.externalId}`}
                  title={item.title}
                  year={item.year}
                  posterUrl={item.posterUrl}
                  type={item.type}
                  rating={item.ratingCount > 0 ? item.communityRating : null}
                  ratingLabel="Average rating on this instance"
                  average
                  to={mediaHref(item)}
                />
              ))}
            </PosterGrid>

            <div className="mt-8 flex items-center justify-center gap-3">
              <Button disabled={page === 1 || isFetching} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <span className="font-data text-[13px] text-muted">Page {page}</span>
              <Button disabled={!data?.hasMore || isFetching} onClick={() => setPage(page + 1)}>
                Next
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
  busy,
}: {
  filters: Filters;
  onChange: (next: Partial<Filters>) => void;
  busy: boolean;
}): JSX.Element {
  // In the installed app the filters are one row that scrolls sideways, so
  // posters start a third of a screen higher than a 2×2 grid of selects allows.
  const cell = 'w-full sm:w-auto app:w-auto app:shrink-0';
  return (
    <div className="grid grid-cols-2 items-center gap-2 border-b border-border pb-5 app:-mx-4 app:flex app:overflow-x-auto app:px-4 app:pb-3 app:[scrollbar-width:none] sm:flex sm:flex-wrap">
      <Segmented
        label="Films or shows"
        value={filters.type}
        onChange={(type) => onChange({ type, genre: '' })}
        options={[
          { value: 'MOVIE', label: 'Films' },
          { value: 'TV', label: 'Shows' },
        ]}
        className="col-span-2 w-fit shrink-0 sm:mr-1"
      />

      <Select
        value={filters.genre}
        onChange={(e) => onChange({ genre: e.target.value })}
        aria-label="Genre"
        className={cell}
      >
        <option value="">Any genre</option>
        {/* A genre linked from a title's page may be one the provider can't browse by. */}
        {filters.genre && !(BROWSE_GENRES as readonly string[]).includes(filters.genre) && (
          <option value={filters.genre}>{filters.genre}</option>
        )}
        {BROWSE_GENRES.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </Select>

      <Select
        value={filters.decade}
        onChange={(e) => onChange({ decade: e.target.value ? Number(e.target.value) : '' })}
        aria-label="Decade"
        className={cell}
      >
        <option value="">Any decade</option>
        {decadeOptions().map((d) => (
          <option key={d} value={d}>
            {d}s
          </option>
        ))}
      </Select>

      <Select
        value={filters.minRating}
        onChange={(e) => onChange({ minRating: e.target.value ? Number(e.target.value) : '' })}
        aria-label="Minimum rating"
        className={cell}
      >
        <option value="">Any rating</option>
        {MIN_RATING_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>

      <Select
        value={filters.sort}
        onChange={(e) => onChange({ sort: e.target.value as BrowseSort })}
        aria-label="Sort by"
        className={cell}
      >
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            Sort: {s.label}
          </option>
        ))}
      </Select>
      {busy && <Spinner className="h-4 w-4" />}
    </div>
  );
}
