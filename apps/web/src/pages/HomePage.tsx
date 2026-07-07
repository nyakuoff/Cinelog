import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { LibraryItem } from '@cinelog/contracts';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { PosterCard } from '../components/PosterCard';
import { Spinner } from '../components/ui';
import { cn } from '../lib/cn';

type Filter = 'all' | 'watchlist' | 'favorites';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'watchlist', label: 'Watchlist' },
  { key: 'favorites', label: 'Favorites' },
];

export function HomePage(): JSX.Element {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['library'],
    queryFn: () => api.getLibrary(),
  });

  const items = (data?.items ?? []).filter((i) => matches(i, filter));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Your Library</h1>
        <div className="flex gap-1 rounded-xl border border-border bg-surface p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm',
                filter === f.key
                  ? 'bg-surface-2 text-content'
                  : 'text-muted hover:text-content',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-24">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {items.map((item) => (
            <PosterCard
              key={item.id}
              title={item.title}
              year={item.year}
              type={item.type}
              posterUrl={item.posterUrl}
              rating={item.rating}
              ratingScale={user?.ratingScale}
              onClick={() => navigate(`/media/${item.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function matches(item: LibraryItem, filter: Filter): boolean {
  if (filter === 'watchlist') return item.isWatchlisted;
  if (filter === 'favorites') return item.isFavorite;
  return true;
}

function EmptyState(): JSX.Element {
  return (
    <div className="rounded-2xl border border-dashed border-border py-20 text-center">
      <p className="text-content">Nothing here yet.</p>
      <p className="mt-1 text-sm text-muted">
        Use the search bar above to find something to watch.
      </p>
    </div>
  );
}
