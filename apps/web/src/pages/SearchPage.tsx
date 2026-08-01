import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { SearchResult } from '@cinelog/contracts';
import { api } from '../lib/api';
import { useAppShell } from '../lib/appShell';
import { PosterCard } from '../components/PosterCard';
import { EmptyState } from '../components/lb';
import { Spinner } from '../components/ui';

export function SearchPage(): JSX.Element {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const navigate = useNavigate();
  const appShell = useAppShell();
  const [opening, setOpening] = useState(false);

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
    const timer = setTimeout(() => {
      setParams(draft.trim() ? { q: draft.trim() } : {}, { replace: true });
    }, 350);
    return () => clearTimeout(timer);
  }, [draft, q, setParams]);

  // Arriving at an empty search tab, the one thing you want is the keyboard.
  useEffect(() => {
    if (appShell && !q) inputRef.current?.focus();
  }, [appShell, q]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['search', q],
    queryFn: () => api.search(q),
    enabled: q.length > 0,
  });

  /** Open a result: navigate straight if cached, else resolve then navigate. */
  async function open(result: SearchResult): Promise<void> {
    if (result.id) {
      navigate(`/media/${result.id}`);
      return;
    }
    setOpening(true);
    try {
      const detail = await api.resolveMedia({
        provider: result.provider,
        externalId: result.externalId,
        type: result.type,
      });
      navigate(`/media/${detail.id}`);
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="mb-5 font-cond text-2xl font-extrabold uppercase tracking-tight app:hidden">
        Search
      </h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setParams(draft.trim() ? { q: draft.trim() } : {}, { replace: true });
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
          <span aria-hidden="true" className="text-muted-2">
            ⌕
          </span>
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            placeholder="Films, shows, anime…"
            aria-label="Search"
            className="h-11 w-full bg-transparent text-sm text-content outline-none placeholder:text-muted-2"
          />
          {draft && (
            <button
              type="button"
              onClick={() => {
                setDraft('');
                setParams({}, { replace: true });
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="px-1 text-muted-2 hover:text-content"
            >
              ✕
            </button>
          )}
        </div>
      </form>

      {!q ? (
        <EmptyState
          title="Find something to log"
          body="Search the catalogue by title. Anything you open can be rated, reviewed, or put on your watchlist."
        />
      ) : isLoading || opening ? (
        <div className="flex justify-center py-24">
          <Spinner />
        </div>
      ) : isError ? (
        <p className="text-sm text-rose">Search failed. Is TMDB configured?</p>
      ) : (data?.results.length ?? 0) === 0 ? (
        <p className="text-muted">No results found.</p>
      ) : (
        <div className="grid grid-cols-3 gap-x-2.5 gap-y-4 sm:grid-cols-4 sm:gap-x-4 sm:gap-y-6 md:grid-cols-5 lg:grid-cols-6">
          {data?.results.map((r, i) => (
            <PosterCard
              key={`${r.provider}:${r.externalId}`}
              title={r.title}
              year={r.year}
              type={r.type}
              posterUrl={r.posterUrl}
              index={i}
              onClick={() => void open(r)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
