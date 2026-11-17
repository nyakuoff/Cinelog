import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { LibraryItem } from '@cinelog/contracts';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { sortLibrary, type SortKey } from '../lib/sortLibrary';
import { SortSelect } from '../components/SortSelect';
import {
  EmptyState,
  isEpisodic,
  mediaHref,
  PageHeader,
  Poster,
  PosterGrid,
} from '../components/lb';
import { buttonClass, Segmented, Spinner } from '../components/ui';

// Same Films/Shows split as the library, kept separate here.
type Group = 'FILMS' | 'SHOWS';
const groupOf = (item: LibraryItem): Group => (isEpisodic(item.type) ? 'SHOWS' : 'FILMS');

export function WatchlistPage(): JSX.Element {
  const { user } = useAuth();
  const [group, setGroup] = useState<Group>('FILMS');
  const [sort, setSort] = useState<SortKey>('added');

  const { data, isLoading } = useQuery({ queryKey: ['library'], queryFn: () => api.getLibrary() });
  const watchlist = useMemo(() => (data?.items ?? []).filter((i) => i.isWatchlisted), [data]);
  const groupItems = useMemo(
    () =>
      sortLibrary(
        watchlist.filter((i) => groupOf(i) === group),
        sort,
      ),
    [watchlist, group, sort],
  );
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const i of watchlist) c[groupOf(i)] = (c[groupOf(i)] ?? 0) + 1;
    return c;
  }, [watchlist]);
  const count = (g: Group): number => counts[g] ?? 0;

  if (isLoading) return <Spinner center />;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 app:py-4 sm:px-6">
      <PageHeader
        title="Watchlist"
        actions={
          watchlist.length > 0 ? (
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
              <SortSelect value={sort} onChange={setSort} />
            </>
          ) : undefined
        }
      />

      {watchlist.length === 0 ? (
        <EmptyState
          title="Your watchlist is empty"
          body="Find something you want to see and stamp it Watchlist on its page to save it here."
          action={
            <Link to="/search" className={buttonClass({ variant: 'primary' })}>
              Find something to watch
            </Link>
          }
        />
      ) : groupItems.length === 0 ? (
        <EmptyState
          compact
          title={`No ${group === 'FILMS' ? 'films' : 'shows'} on your watchlist yet`}
        />
      ) : (
        <PosterGrid>
          {groupItems.map((item) => (
            <Poster
              key={item.id}
              title={item.title}
              year={item.year}
              type={item.type}
              posterUrl={item.posterUrl}
              rating={item.rating}
              liked={item.isFavorite}
              to={mediaHref(item, user?.username)}
            />
          ))}
        </PosterGrid>
      )}
    </div>
  );
}
