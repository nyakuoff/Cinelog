import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { cn } from '../lib/cn';
import { Button, Spinner } from './ui';

interface Props {
  mediaId: string;
  onClose: () => void;
}

/** Poster picker — sets the caller's own poster override for this title. Only
 *  ever surfaces in a library context: their own library, and anyone else's
 *  view of their profile/library. The media page itself — even the caller's
 *  own view of it, however they navigated in — always shows the title's
 *  actual default poster. There's no backdrop picker: posters only. */
export function ArtworkPickerModal({ mediaId, onClose }: Props): JSX.Element {
  const queryClient = useQueryClient();

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const { data, isLoading } = useQuery({
    queryKey: ['poster-options', mediaId],
    queryFn: () => api.getPosterOptions(mediaId),
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['poster-options', mediaId] });
    void queryClient.invalidateQueries({ queryKey: ['media', mediaId] });
    void queryClient.invalidateQueries({ queryKey: ['library'] });
  };
  const applyMut = useMutation({
    mutationFn: (sourceUrl: string) => api.setPoster(mediaId, sourceUrl),
    onSuccess: invalidate,
  });
  const resetMut = useMutation({
    mutationFn: () => api.setPoster(mediaId, null),
    onSuccess: invalidate,
  });

  const choices = data?.posters ?? [];
  const selected = data?.currentPosterUrl ?? null;
  const busy = applyMut.isPending || resetMut.isPending;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Change poster"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-surface shadow-soft"
      >
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <h2 className="w-full font-cond text-lg font-extrabold uppercase tracking-tight sm:w-auto sm:mr-auto">
            Change poster
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-content sm:ml-0"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          ) : choices.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted">
              No alternate posters are available for this title.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {choices.map((c) => {
                const isSelected = c.sourceUrl === selected;
                return (
                  <button
                    key={c.sourceUrl}
                    disabled={busy}
                    onClick={() => applyMut.mutate(c.sourceUrl)}
                    className={cn(
                      'group relative aspect-[2/3] overflow-hidden rounded-lg border-2 bg-surface-2 transition-colors disabled:opacity-60',
                      isSelected ? 'border-gold' : 'border-transparent hover:border-border-hi',
                    )}
                  >
                    <img
                      src={c.previewUrl}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    {isSelected && (
                      <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-gold text-[11px] font-bold text-ink">
                        ✓
                      </span>
                    )}
                    {c.language && (
                      <span className="absolute bottom-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] uppercase text-muted backdrop-blur">
                        {c.language}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border p-4">
          <p className="text-xs text-muted-2">
            Changes it in your library, not on this page.
          </p>
          <div className="flex gap-2">
            {data?.hasOverride && (
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => resetMut.mutate()}>
                Reset to default
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
