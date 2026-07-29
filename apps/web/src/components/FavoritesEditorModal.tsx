import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FavoriteSlot, LibraryItem } from '@cinelog/contracts';
import { api, ApiError } from '../lib/api';
import { cn } from '../lib/cn';
import { posterGradient } from '../lib/poster';
import { Button, Input, Spinner } from './ui';

interface Props {
  username: string;
  initialFilms: FavoriteSlot[];
  initialShows: FavoriteSlot[];
  onClose: () => void;
}

const SHOW_TYPES = new Set(['TV', 'ANIME', 'CARTOON', 'MINISERIES', 'SPECIAL']);

export function FavoritesEditorModal({ username, initialFilms, initialShows, onClose }: Props): JSX.Element {
  const queryClient = useQueryClient();
  const [films, setFilms] = useState<string[]>(initialFilms.map((f) => f.media.id));
  const [shows, setShows] = useState<string[]>(initialShows.map((f) => f.media.id));
  const [query, setQuery] = useState('');

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const { data, isLoading } = useQuery({
    queryKey: ['library'],
    queryFn: () => api.getLibrary(),
  });

  const mut = useMutation({
    mutationFn: () => api.updateFavorites({ filmIds: films, showIds: shows }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile', username] });
      onClose();
    },
  });

  const q = query.trim().toLowerCase();
  const items = (data?.items ?? []).filter((i) => !q || i.title.toLowerCase().includes(q));
  const filmItems = items.filter((i) => i.type === 'MOVIE');
  const showItems = items.filter((i) => SHOW_TYPES.has(i.type));
  const byId = new Map((data?.items ?? []).map((i) => [i.id, i]));

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-ink/85 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit favorites"
        onClick={(e) => e.stopPropagation()}
        className="my-auto flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-surface shadow-soft"
      >
        <div className="flex items-center gap-3 border-b border-border p-4">
          <h2 className="mr-auto font-cond text-lg font-extrabold uppercase tracking-tight">
            Your favorites
          </h2>
        </div>

        <div className="border-b border-border p-4">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your library…"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : (data?.items.length ?? 0) === 0 ? (
            <p className="text-sm text-muted">
              Nothing in your library yet — rate or track a title first, then come back here.
            </p>
          ) : (
            <div className="space-y-8">
              <FavoriteSide
                label="Favorite films"
                slots={films}
                onToggle={(id) =>
                  setFilms((prev) =>
                    prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 4 ? prev : [...prev, id],
                  )
                }
                onReorder={(from, to) =>
                  setFilms((prev) => {
                    const next = [...prev];
                    const [moved] = next.splice(from, 1);
                    if (moved) next.splice(to, 0, moved);
                    return next;
                  })
                }
                byId={byId}
                pool={filmItems}
                emptyPool={q ? 'No films in your library match that search.' : 'No films in your library yet.'}
              />
              <FavoriteSide
                label="Favorite shows"
                slots={shows}
                onToggle={(id) =>
                  setShows((prev) =>
                    prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 4 ? prev : [...prev, id],
                  )
                }
                onReorder={(from, to) =>
                  setShows((prev) => {
                    const next = [...prev];
                    const [moved] = next.splice(from, 1);
                    if (moved) next.splice(to, 0, moved);
                    return next;
                  })
                }
                byId={byId}
                pool={showItems}
                emptyPool={q ? 'No shows in your library match that search.' : 'No shows in your library yet.'}
              />
            </div>
          )}
        </div>

        {mut.isError && (
          <p className="mx-4 mb-2 rounded-lg border border-rose/30 bg-rose/10 px-3 py-2 text-sm text-rose">
            {mut.error instanceof ApiError ? mut.error.message : 'Could not save favorites'}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-border p-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? 'Saving…' : 'Save favorites'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function FavoriteSide({
  label,
  slots,
  onToggle,
  onReorder,
  byId,
  pool,
  emptyPool,
}: {
  label: string;
  slots: string[];
  onToggle: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  byId: Map<string, LibraryItem>;
  pool: LibraryItem[];
  emptyPool: string;
}): JSX.Element {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-cond text-[13px] font-bold uppercase tracking-[0.12em] text-muted">{label}</h3>
        <span className="text-xs text-muted-2">{slots.length}/4 selected — drag to reorder</span>
      </div>

      <div className="mb-4 grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }, (_, i) => {
          const id = slots[i];
          const item = id ? byId.get(id) : undefined;
          return (
            <div
              key={i}
              draggable={!!id}
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null && dragIndex !== i) onReorder(dragIndex, i);
                setDragIndex(null);
              }}
              className={cn(
                'relative aspect-[2/3] overflow-hidden rounded-md border-2 border-dashed border-border bg-surface-2',
                item && 'cursor-grab border-solid border-gold active:cursor-grabbing',
              )}
            >
              {item ? (
                <>
                  {item.posterUrl ? (
                    <img src={item.posterUrl} alt={item.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="absolute inset-0" style={{ background: posterGradient(item.title) }} />
                  )}
                  <button
                    onClick={() => onToggle(item.id)}
                    title="Remove"
                    className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-xs text-white hover:bg-rose"
                  >
                    ✕
                  </button>
                </>
              ) : (
                <span className="absolute inset-0 grid place-items-center text-xs text-muted-2">
                  Slot {i + 1}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {pool.length === 0 ? (
        <p className="text-sm text-muted-2">{emptyPool}</p>
      ) : (
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
          {pool.map((item) => {
            const isSelected = slots.includes(item.id);
            return (
              <button
                key={item.id}
                onClick={() => onToggle(item.id)}
                className={cn(
                  'relative aspect-[2/3] overflow-hidden rounded-md outline outline-2 outline-offset-2 outline-transparent',
                  isSelected && 'outline-gold',
                )}
              >
                {item.posterUrl ? (
                  <img src={item.posterUrl} alt={item.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="absolute inset-0" style={{ background: posterGradient(item.title) }} />
                )}
                {isSelected && (
                  <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-gold text-[11px] font-bold text-ink">
                    {slots.indexOf(item.id) + 1}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
