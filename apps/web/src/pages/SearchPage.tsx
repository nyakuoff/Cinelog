import { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAppShell } from '../lib/appShell';
import { IconSearch, IconX } from '../components/app/Icons';
import { ListCard } from '../components/ListCard';
import { MemberCard } from '../components/MemberCard';
import {
  EmptyState,
  ErrorState,
  mediaHref,
  PageHeader,
  PosterThumb,
  TabBar,
  TYPE_LABEL,
} from '../components/lb';
import { LoadMore, Spinner } from '../components/ui';

const TABS = [
  { key: 'titles', label: 'Titles' },
  { key: 'members', label: 'Members' },
  { key: 'lists', label: 'Lists' },
] as const;
type Tab = (typeof TABS)[number]['key'];

export function SearchPage(): JSX.Element {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const tab: Tab = TABS.find((t) => t.key === params.get('tab'))?.key ?? 'titles';
  /** The query and tab both live in the URL; defaults are left out of it. */
  const write = (nextQ: string, nextTab: Tab = tab): void =>
    setParams(
      { ...(nextQ ? { q: nextQ } : {}), ...(nextTab !== 'titles' ? { tab: nextTab } : {}) },
      { replace: true },
    );
  const appShell = useAppShell();

  /**
   * The field lives on the screen, not in a masthead.
   *
   * It always did on the website, but the installed app has no masthead at all,
   * and this page's old copy ("type in the search bar above") pointed at a bar
   * that isn't there. Search is a destination on a phone, so it carries its own
   * input — and the query still lives in the URL, so a result you found is a
   * link you can share and a back button that works.
   */
  const [draft, setDraft] = useState(q);
  const inputRef = useRef<HTMLInputElement>(null);

  // The URL is the source of truth (back/forward, shared links), so an external
  // change to it wins over whatever is half-typed.
  useEffect(() => setDraft(q), [q]);

  // Search as you type, but not on every keystroke — each one is a provider
  // call. `replace` so a search doesn't leave twelve prefixes in history.
  useEffect(() => {
    if (draft === q) return;
    const timer = setTimeout(() => write(draft.trim()), 350);
    return () => clearTimeout(timer);
    // `write` closes over the current tab; re-arming on it would be a no-op.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, q]);

  // Arriving at an empty search tab, the one thing you want is the keyboard.
  useEffect(() => {
    if (appShell && !q) inputRef.current?.focus();
  }, [appShell, q]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['search', q],
    queryFn: () => api.search(q),
    enabled: q.length > 0 && tab === 'titles',
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 app:py-4 sm:px-6">
      <PageHeader title="Search" />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          write(draft.trim());
          inputRef.current?.blur();
        }}
        role="search"
        /* Sticky under the app's title bar so the query stays put while you
           scroll a long result grid looking for the right artwork. */
        /* `not-app:sm:*` rather than plain `sm:*`: an installed tablet is still
           the app, and the field should stay pinned there too. */
        className="sticky top-0 z-20 -mx-4 mb-5 bg-bg px-4 py-2 app:top-appbar not-app:sm:static not-app:sm:mx-0 not-app:sm:px-0"
      >
        <div className="flex items-center gap-2 rounded-sm border border-border bg-bg-2 px-3 focus-within:border-gold">
          <IconSearch className="h-4 w-4 shrink-0 text-muted-2" />
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            placeholder="Films, shows, members, lists…"
            aria-label="Search"
            className="h-11 w-full bg-transparent text-sm text-content outline-none placeholder:text-muted-2"
          />
          {draft && (
            <button
              type="button"
              onClick={() => {
                setDraft('');
                write('');
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="-mr-3 grid h-11 w-11 shrink-0 place-items-center text-muted-2 hover:text-content"
            >
              <IconX />
            </button>
          )}
        </div>
      </form>

      <TabBar className="mb-5" tabs={[...TABS]} active={tab} onChange={(k) => write(q, k as Tab)} />

      {!q ? (
        <EmptyState
          title="Find something to log"
          body="Search the catalogue by title, or look up a member or a list. Anything you open can be rated, reviewed, or put on your watchlist."
        />
      ) : tab === 'members' ? (
        <MemberResults q={q} />
      ) : tab === 'lists' ? (
        <ListResults q={q} />
      ) : isLoading ? (
        <Spinner center />
      ) : isError ? (
        <ErrorState
          title="Search failed"
          body="The metadata provider didn't respond. Check that TMDB is configured."
          onRetry={() => void refetch()}
        />
      ) : (data?.results.length ?? 0) === 0 ? (
        <EmptyState compact title="No results" body={`Nothing in the catalogue matches “${q}”.`} />
      ) : (
        // Captioned rows, not a bare poster wall: with a title typed in, the
        // year and medium are what tell two same-named results apart.
        <ul className="divide-y divide-border">
          {data?.results.map((r) => {
            const to = mediaHref(r);
            return (
              <li key={`${r.provider}:${r.externalId}`} className="flex items-start gap-3.5 py-3">
                <PosterThumb title={r.title} posterUrl={r.posterUrl} to={to} size="lg" />
                <div className="min-w-0 flex-1">
                  <Link to={to} className="group block">
                    <span className="font-cond text-[17px] font-extrabold uppercase leading-tight tracking-[0.02em] text-content group-hover:text-gold">
                      {r.title}
                    </span>
                    {r.year && (
                      <span className="ml-2 font-data text-[13px] text-muted-2">{r.year}</span>
                    )}
                  </Link>
                  <p className="mt-1 font-cond text-[11px] font-bold uppercase tracking-[0.14em] text-muted-2">
                    {TYPE_LABEL[r.type]}
                    {r.originalTitle && r.originalTitle !== r.title && (
                      <span className="ml-2 font-sans font-normal normal-case tracking-normal">
                        {r.originalTitle}
                      </span>
                    )}
                  </p>
                  {r.overview && (
                    <p className="mt-1.5 line-clamp-2 max-w-[70ch] text-sm text-muted">
                      {r.overview}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function MemberResults({ q }: { q: string }): JSX.Element {
  const query = useInfiniteQuery({
    queryKey: ['members', 'search', q],
    queryFn: ({ pageParam }) => api.searchMembers(q, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const members = query.data?.pages.flatMap((p) => p.members) ?? [];
  if (query.isLoading) return <Spinner center />;
  if (query.isError)
    return <ErrorState title="Search failed" onRetry={() => void query.refetch()} />;
  if (members.length === 0) {
    return <EmptyState compact title="No members" body={`No one here matches “${q}”.`} />;
  }
  return (
    <>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {members.map((m) => (
          <MemberCard key={m.id} member={m} />
        ))}
      </div>
      <LoadMore query={query} />
    </>
  );
}

function ListResults({ q }: { q: string }): JSX.Element {
  const query = useInfiniteQuery({
    queryKey: ['lists', 'search', q],
    queryFn: ({ pageParam }) => api.searchLists(q, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const lists = query.data?.pages.flatMap((p) => p.lists) ?? [];
  if (query.isLoading) return <Spinner center />;
  if (query.isError)
    return <ErrorState title="Search failed" onRetry={() => void query.refetch()} />;
  if (lists.length === 0) {
    return <EmptyState compact title="No lists" body={`No list matches “${q}”.`} />;
  }
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {lists.map((l) => (
          <ListCard key={l.id} list={l} />
        ))}
      </div>
      <LoadMore query={query} />
    </>
  );
}
