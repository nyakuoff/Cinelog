import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type {
  DiscoverFilterItem,
  DiscoverSection,
  DiscoverSortKey,
  MediaType,
  SearchResult,
} from '@cinelog/contracts';
import { api } from '../lib/api';
import { cn } from '../lib/cn';
import { PosterCard } from '../components/PosterCard';
import { ActivityFeed } from '../components/ActivityFeed';
import { SectionHeader } from '../components/lb';
import { Spinner } from '../components/ui';

const GENRES = [
  'Action',
  'Adventure',
  'Animation',
  'Comedy',
  'Crime',
  'Documentary',
  'Drama',
  'Fantasy',
  'Horror',
  'Mystery',
  'Romance',
  'Science Fiction',
  'Thriller',
];

const SORTS: { value: DiscoverSortKey; label: string }[] = [
  { value: 'POPULARITY', label: 'Popularity' },
  { value: 'RELEASE_DATE', label: 'Release date' },
  { value: 'CINELOG_RATING', label: 'Cinelog rating' },
  { value: 'RATING_COUNT', label: 'Number of ratings' },
];

function decadeOptions(): number[] {
  const start = 1950;
  const end = new Date().getFullYear();
  const out: number[] = [];
  for (let y = Math.floor(end / 10) * 10; y >= start; y -= 10) out.push(y);
  return out;
}

interface Filters {
  type: MediaType | '';
  genre: string;
  decade: number | '';
  minRating: number | '';
  sort: DiscoverSortKey;
}

const DEFAULT_FILTERS: Filters = { type: '', genre: '', decade: '', minRating: '', sort: 'POPULARITY' };

function isActive(f: Filters): boolean {
  return f.type !== '' || f.genre !== '' || f.decade !== '' || f.minRating !== '' || f.sort !== 'POPULARITY';
}

export function DiscoverPage(): JSX.Element {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [opening, setOpening] = useState(false);
  const active = isActive(filters);

  const sections = useQuery({
    queryKey: ['discover'],
    queryFn: () => api.getDiscover(),
    enabled: !active,
  });

  const filtered = useQuery({
    queryKey: ['discover-filter', filters],
    queryFn: () =>
      api.getDiscoverFilter({
        type: filters.type || undefined,
        genre: filters.genre || undefined,
        decade: filters.decade || undefined,
        minRating: filters.minRating || undefined,
        sort: filters.sort,
      }),
    enabled: active,
  });

  async function open(item: SearchResult | DiscoverFilterItem): Promise<void> {
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 font-cond text-3xl font-extrabold uppercase tracking-[0.04em]">Discover</h1>

      <FilterBar filters={filters} onChange={setFilters} />

      {opening && (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      )}

      {active ? (
        filtered.isLoading ? (
          <div className="flex justify-center py-24">
            <Spinner />
          </div>
        ) : filtered.isError ? (
          <p className="py-10 text-center text-sm text-rose">Could not load results. Try again.</p>
        ) : (filtered.data?.items.length ?? 0) === 0 ? (
          <p className="py-10 text-center text-muted">Nothing matches these filters yet.</p>
        ) : (
          <div className="mt-8 grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {filtered.data?.items.map((item, i) => (
              <PosterCard
                key={`${item.provider}:${item.externalId}`}
                title={item.title}
                year={item.year}
                type={item.type}
                posterUrl={item.posterUrl}
                index={i}
                onClick={() => void open(item)}
              />
            ))}
          </div>
        )
      ) : sections.isLoading ? (
        <div className="flex justify-center py-24">
          <Spinner />
        </div>
      ) : sections.isError ? (
        <p className="py-10 text-center text-sm text-rose">Could not load Discover right now.</p>
      ) : (sections.data?.sections.length ?? 0) === 0 ? (
        <p className="py-10 text-center text-muted">Nothing to discover yet.</p>
      ) : (
        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-10">
            {sections.data?.sections.map((s) => (
              <Rail key={s.key} section={s} onOpen={open} />
            ))}
          </div>

          {/* Friend activity rail — what a signed-in member sees first. */}
          <aside className="space-y-8">
            <section>
              <SectionHeader title="From people you follow" more="/members" moreLabel="Find members" />
              <ActivityFeed
                scope="FOLLOWING"
                emptyTitle="No activity yet"
                emptyBody="Follow other members and their ratings, reviews, and watches show up here."
              />
            </section>
            <section>
              <SectionHeader title="Recent on Cinelog" />
              <ActivityFeed
                scope="EVERYONE"
                emptyTitle="Nothing logged yet"
                emptyBody="Activity from everyone on this instance appears here."
              />
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}

function FilterBar({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
}): JSX.Element {
  const selectClass =
    'h-9 rounded-sm border border-border bg-bg-2 px-2.5 font-cond text-[12px] font-bold uppercase tracking-[0.08em] text-content focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold';
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border pb-5">
      <select
        value={filters.type}
        onChange={(e) => onChange({ ...filters, type: e.target.value as Filters['type'] })}
        className={selectClass}
      >
        <option value="">All types</option>
        <option value="MOVIE">Movies</option>
        <option value="TV">Shows</option>
      </select>
      <select
        value={filters.genre}
        onChange={(e) => onChange({ ...filters, genre: e.target.value })}
        className={selectClass}
      >
        <option value="">All genres</option>
        {GENRES.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </select>
      <select
        value={filters.decade}
        onChange={(e) => onChange({ ...filters, decade: e.target.value ? Number(e.target.value) : '' })}
        className={selectClass}
      >
        <option value="">All decades</option>
        {decadeOptions().map((d) => (
          <option key={d} value={d}>
            {d}s
          </option>
        ))}
      </select>
      <select
        value={filters.minRating}
        onChange={(e) =>
          onChange({ ...filters, minRating: e.target.value ? Number(e.target.value) : '' })
        }
        className={selectClass}
      >
        <option value="">Any rating</option>
        <option value="50">50%+</option>
        <option value="70">70%+</option>
        <option value="85">85%+</option>
      </select>
      <select
        value={filters.sort}
        onChange={(e) => onChange({ ...filters, sort: e.target.value as DiscoverSortKey })}
        className={selectClass}
      >
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            Sort: {s.label}
          </option>
        ))}
      </select>
      {isActive(filters) && (
        <button
          onClick={() => onChange(DEFAULT_FILTERS)}
          className="h-9 rounded-lg px-2.5 text-[13px] text-muted hover:text-content"
        >
          Clear
        </button>
      )}
    </div>
  );
}

function Rail({
  section,
  onOpen,
}: {
  section: DiscoverSection;
  onOpen: (item: SearchResult) => void;
}): JSX.Element {
  return (
    <section>
      <SectionHeader
        title={section.title}
        right={
          <span
            className={cn(
              'font-cond text-[10px] font-bold uppercase tracking-[0.14em]',
              section.source === 'CINELOG' ? 'text-gold' : 'text-muted-2',
            )}
          >
            {section.source === 'CINELOG' ? 'Cinelog community' : 'via TMDB'}
          </span>
        }
      />
      <div className="rail-mask -mx-1 overflow-x-auto pb-2 scrollbar-none">
        <div className="flex gap-3.5 px-1">
          {section.items.map((item, i) => (
            <div key={`${item.provider}:${item.externalId}`} className="w-[130px] shrink-0 sm:w-[150px]">
              {/* No type chip here: the section heading above already
                  states the medium, so per-tile labels would just repeat it. */}
              <PosterCard
                title={item.title}
                year={item.year}
                posterUrl={item.posterUrl}
                index={i}
                onClick={() => onOpen(item)}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
