import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SearchResult } from '@cinelog/contracts';
import { api, ApiError } from '../lib/api';
import { cn } from '../lib/cn';
import { Button, Input, Spinner } from './ui';

interface Props {
  mediaId: string;
  currentTitle: string;
  onClose: () => void;
}

export function RematchModal({ mediaId, currentTitle, onClose }: Props): JSX.Element {
  const [query, setQuery] = useState(currentTitle);
  const [debounced, setDebounced] = useState(currentTitle);
  const queryClient = useQueryClient();

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['search', debounced],
    queryFn: () => api.search(debounced),
    enabled: debounced.trim().length > 0,
  });

  const rematchMut = useMutation({
    mutationFn: (r: SearchResult) =>
      api.rematchMedia(mediaId, { provider: r.provider, externalId: r.externalId, type: r.type }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['media', mediaId] });
      void queryClient.invalidateQueries({ queryKey: ['library'] });
      onClose();
    },
  });

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Fix mismatched title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-surface shadow-soft"
      >
        <div className="flex items-center gap-3 border-b border-border p-4">
          <h2 className="font-cond text-lg font-extrabold uppercase tracking-tight">
            Fix mismatched title
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-content"
          >
            ✕
          </button>
        </div>

        <div className="border-b border-border p-4">
          <p className="mb-3 text-sm text-muted">
            Search for the title this should actually be. Your status, rating, and watch history stay
            attached — only the cached metadata (and any episode/artwork data tied to the current
            mismatch) is replaced.
          </p>
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for the correct title…"
          />
        </div>

        <div className="overflow-y-auto p-4">
          {rematchMut.isError && (
            <p className="mb-3 rounded-lg border border-rose/30 bg-rose/10 px-3 py-2 text-sm text-rose">
              {rematchMut.error instanceof ApiError
                ? rematchMut.error.message
                : 'Something went wrong'}
            </p>
          )}

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          ) : isError ? (
            <p className="py-16 text-center text-sm text-rose">Search failed.</p>
          ) : (data?.results.length ?? 0) === 0 ? (
            <p className="py-16 text-center text-sm text-muted">No matches found.</p>
          ) : (
            <div className="space-y-1.5">
              {data?.results.map((r) => (
                <button
                  key={`${r.provider}:${r.externalId}`}
                  disabled={rematchMut.isPending}
                  onClick={() => rematchMut.mutate(r)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border border-border p-2 text-left transition-colors',
                    'hover:border-border-hi hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-60',
                  )}
                >
                  <div className="h-16 w-11 shrink-0 overflow-hidden rounded-md bg-surface-2">
                    {r.posterUrl && (
                      <img src={r.posterUrl} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-content">{r.title}</p>
                    <p className="text-xs text-muted">
                      {r.year ?? '—'} · {r.type}
                    </p>
                    {r.overview && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-2">{r.overview}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border p-4">
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
