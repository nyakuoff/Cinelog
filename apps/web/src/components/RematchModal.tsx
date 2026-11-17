import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SearchResult } from '@cinelog/contracts';
import { api, ApiError } from '../lib/api';
import { cn } from '../lib/cn';
import { Dialog } from './Dialog';
import { PosterThumb, TYPE_LABEL } from './lb';
import { Input, Notice, Spinner } from './ui';

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
    <Dialog
      title="Fix mismatched title"
      size="lg"
      onClose={onClose}
      toolbar={
        <>
          <p className="mb-3 text-sm text-muted">
            Search for the title this should actually be. Your status, rating, and watch history
            stay attached — only the cached metadata (and any episode/artwork data tied to the
            current mismatch) is replaced.
          </p>
          <Input
            data-autofocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for the correct title…"
            aria-label="Search for the correct title"
          />
        </>
      }
    >
      {rematchMut.isError && (
        <Notice className="mb-3">
          {rematchMut.error instanceof ApiError ? rematchMut.error.message : 'Something went wrong'}
        </Notice>
      )}

      {isLoading ? (
        <Spinner center />
      ) : isError ? (
        <Notice>Search failed. Check that TMDB is configured.</Notice>
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
                'flex w-full items-center gap-3 rounded-sm border border-border p-2 text-left',
                'hover:border-border-hi hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-60',
              )}
            >
              <PosterThumb title={r.title} posterUrl={r.posterUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-content">{r.title}</p>
                <p className="font-data text-[11px] text-muted">
                  {r.year ?? '—'} · {TYPE_LABEL[r.type]}
                </p>
                {r.overview && (
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-2">{r.overview}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </Dialog>
  );
}
