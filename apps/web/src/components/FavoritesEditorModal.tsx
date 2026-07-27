import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FavoriteSlot, LibraryItem } from '@cinelog/contracts';
import { api, ApiError } from '../lib/api';
import { cn } from '../lib/cn';
import { posterGradient } from '../lib/poster';
import { Button, Spinner } from './ui';

interface Props {
  username: string;
  initial: FavoriteSlot[];
  onClose: () => void;
}

export function FavoritesEditorModal({ username, initial, onClose }: Props): JSX.Element {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string[]>(initial.map((f) => f.media.id));
  const [dragIndex, setDragIndex] = useState<number | null>(null);

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
    mutationFn: () => api.updateFavorites({ mediaIds: selected }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile', username] });
      onClose();
    },
  });

  function toggle(id: string): void {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  }

  function reorder(from: number, to: number): void {
    setSelected((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      if (moved) next.splice(to, 0, moved);
      return next;
    });
  }

  const byId = new Map((data?.items ?? []).map((i) => [i.id, i]));

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit favorites"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-surface shadow-soft"
      >
        <div className="flex items-center gap-3 border-b border-border p-4">
          <h2 className="mr-auto font-cond text-lg font-extrabold uppercase tracking-tight">
            Your 4 favorites
          </h2>
          <span className="text-xs text-muted-2">{selected.length}/4 selected — drag to reorder</span>
        </div>

        <div className="grid grid-cols-4 gap-3 border-b border-border p-4">
          {Array.from({ length: 4 }, (_, i) => {
            const id = selected[i];
            const item = id ? byId.get(id) : undefined;
            return (
              <div
                key={i}
                draggable={!!id}
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null && dragIndex !== i) reorder(dragIndex, i);
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
                      onClick={() => toggle(item.id)}
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
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
              {data?.items.map((item: LibraryItem) => {
                const isSelected = selected.includes(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => toggle(item.id)}
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
                      <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-gold text-[10px] font-bold text-ink">
                        {selected.indexOf(item.id) + 1}
                      </span>
                    )}
                  </button>
                );
              })}
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
