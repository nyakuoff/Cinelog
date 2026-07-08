import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { scaleForMediaType, type MediaType } from '@cinelog/contracts';
import { api } from '../lib/api';
import { cn } from '../lib/cn';
import { sortLibrary, type SortKey } from '../lib/sortLibrary';
import { PosterCard } from '../components/PosterCard';
import { SortSelect } from '../components/SortSelect';
import { Button, Spinner } from '../components/ui';

// Same Films/Shows split as the home library, kept separate here.
type Group = 'FILMS' | 'SHOWS';
const GROUPS: { key: Group; label: string }[] = [
  { key: 'FILMS', label: 'Films' },
  { key: 'SHOWS', label: 'Shows' },
];
function groupOf(type: MediaType): Group {
  return type === 'MOVIE' || type === 'SPECIAL' ? 'FILMS' : 'SHOWS';
}

export function WatchlistPage(): JSX.Element {
  const navigate = useNavigate();
  const [group, setGroup] = useState<Group>('FILMS');
  const [sort, setSort] = useState<SortKey>('added');

  const { data, isLoading } = useQuery({ queryKey: ['library'], queryFn: () => api.getLibrary() });
  const watchlist = (data?.items ?? []).filter((i) => i.status === 'PLAN_TO_WATCH');
  const groupItems = sortLibrary(watchlist.filter((i) => groupOf(i.type) === group), sort);
  const groupCounts: Record<Group, number> = {
    FILMS: watchlist.filter((i) => groupOf(i.type) === 'FILMS').length,
    SHOWS: watchlist.filter((i) => groupOf(i.type) === 'SHOWS').length,
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-32">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="mb-2 font-cond text-xs font-bold uppercase tracking-[0.2em] text-gold">
        Watchlist
      </p>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-cond text-3xl font-extrabold uppercase tracking-tight">
          Want to watch
        </h1>
        {watchlist.length > 0 && (
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <div className="flex shrink-0 gap-1 rounded-xl border border-border bg-surface p-1">
              {GROUPS.map((g) => (
                <button
                  key={g.key}
                  onClick={() => setGroup(g.key)}
                  className={cn(
                    'shrink-0 whitespace-nowrap rounded-lg px-3.5 py-1.5 font-cond text-[13px] font-bold uppercase tracking-wide transition-colors',
                    group === g.key ? 'bg-gold text-ink' : 'text-muted hover:text-content',
                  )}
                >
                  {g.label}
                  <span
                    className={cn(
                      'ml-1.5 tabular-nums',
                      group === g.key ? 'text-ink/70' : 'text-muted-2',
                    )}
                  >
                    {groupCounts[g.key]}
                  </span>
                </button>
              ))}
            </div>
            <SortSelect value={sort} onChange={setSort} />
          </div>
        )}
      </div>

      {watchlist.length === 0 ? (
        <EmptyWatchlist onSearch={() => navigate('/search')} />
      ) : groupItems.length === 0 ? (
        <p className="py-16 text-center text-muted">
          Nothing on your {group === 'FILMS' ? 'films' : 'shows'} watchlist yet.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {groupItems.map((item, i) => (
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
    </div>
  );
}

function EmptyWatchlist({ onSearch }: { onSearch: () => void }): JSX.Element {
  return (
    <div className="rounded-2xl border border-dashed border-border-hi bg-surface/40 px-6 py-16 text-center">
      <p className="font-cond text-xl font-extrabold uppercase tracking-tight text-content">
        Your watchlist is empty
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Find something you want to see and set its status to{' '}
        <span className="text-content">Plan to Watch</span> to save it here.
      </p>
      <div className="mt-6 flex justify-center">
        <Button variant="primary" size="lg" onClick={onSearch}>
          ⌕ Find something to watch
        </Button>
      </div>
    </div>
  );
}
