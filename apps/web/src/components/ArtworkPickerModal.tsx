import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ArtworkKind } from '@cinelog/contracts';
import { api } from '../lib/api';
import { cn } from '../lib/cn';
import { Button, Spinner } from './ui';

interface Props {
  mediaId: string;
  onClose: () => void;
}

const TABS: { key: ArtworkKind; label: string }[] = [
  { key: 'POSTER', label: 'Poster' },
  { key: 'BACKDROP', label: 'Backdrop' },
];

export function ArtworkPickerModal({ mediaId, onClose }: Props): JSX.Element {
  const [kind, setKind] = useState<ArtworkKind>('POSTER');
  const queryClient = useQueryClient();

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const { data, isLoading } = useQuery({
    queryKey: ['artwork-options', mediaId],
    queryFn: () => api.getArtworkOptions(mediaId),
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['artwork-options', mediaId] });
    void queryClient.invalidateQueries({ queryKey: ['media', mediaId] });
    void queryClient.invalidateQueries({ queryKey: ['library'] });
  };
  const applyMut = useMutation({
    mutationFn: (sourceUrl: string) => api.setArtwork(mediaId, kind, sourceUrl),
    onSuccess: invalidate,
  });
  const resetMut = useMutation({
    mutationFn: () => api.setArtwork(mediaId, kind, null),
    onSuccess: invalidate,
  });

  const choices = data ? (kind === 'POSTER' ? data.posters : data.backdrops) : [];
  const selected = data ? (kind === 'POSTER' ? data.selectedPoster : data.selectedBackdrop) : null;
  const hasOverride = data ? (kind === 'POSTER' ? data.hasPosterOverride : data.hasBackdropOverride) : false;
  const busy = applyMut.isPending || resetMut.isPending;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit artwork"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-surface shadow-soft"
      >
        <div className="flex items-center gap-3 border-b border-border p-4">
          <h2 className="font-cond text-lg font-extrabold uppercase tracking-tight">Edit artwork</h2>
          <div className="ml-auto flex gap-1 rounded-xl border border-border bg-surface-2 p-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setKind(t.key)}
                className={cn(
                  'rounded-lg px-3 py-1 font-cond text-[12px] font-bold uppercase tracking-wide transition-colors',
                  kind === t.key ? 'bg-gold text-ink' : 'text-muted hover:text-content',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-content"
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
              No alternate {kind === 'POSTER' ? 'posters' : 'backdrops'} are available for this title.
            </p>
          ) : (
            <div
              className={cn(
                'grid gap-3',
                kind === 'POSTER' ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3',
              )}
            >
              {choices.map((c) => {
                const isSelected = c.sourceUrl === selected;
                return (
                  <button
                    key={c.sourceUrl}
                    disabled={busy}
                    onClick={() => applyMut.mutate(c.sourceUrl)}
                    className={cn(
                      'group relative overflow-hidden rounded-lg border-2 bg-surface-2 transition-colors disabled:opacity-60',
                      kind === 'POSTER' ? 'aspect-[2/3]' : 'aspect-video',
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
          <p className="text-xs text-muted-2">Only visible to you — no one else's library changes.</p>
          <div className="flex gap-2">
            {hasOverride && (
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
