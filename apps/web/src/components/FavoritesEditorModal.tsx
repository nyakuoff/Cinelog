import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FavoriteSlot, LibraryItem } from '@cinelog/contracts';
import { api, ApiError } from '../lib/api';
import { cn } from '../lib/cn';
import { posterGradient } from '../lib/poster';
import { IconChevronLeft, IconChevronRight, IconX } from './app/Icons';
import { Dialog } from './Dialog';
import { Button, Input, Notice, Spinner } from './ui';

interface Props {
  username: string;
  initialFilms: FavoriteSlot[];
  initialShows: FavoriteSlot[];
  onClose: () => void;
}

const SHOW_TYPES = new Set(['TV', 'ANIME', 'CARTOON', 'MINISERIES', 'SPECIAL']);

export function FavoritesEditorModal({
  username,
  initialFilms,
  initialShows,
  onClose,
}: Props): JSX.Element {
  const queryClient = useQueryClient();
  const [films, setFilms] = useState<string[]>(initialFilms.map((f) => f.media.id));
  const [shows, setShows] = useState<string[]>(initialShows.map((f) => f.media.id));
  const [query, setQuery] = useState('');

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
    <Dialog
      title="Your favorites"
      size="lg"
      onClose={onClose}
      toolbar={
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your library…"
          aria-label="Search your library"
          data-autofocus
        />
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? 'Saving…' : 'Save favorites'}
          </Button>
        </>
      }
    >
      {isLoading ? (
        <Spinner center />
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
                prev.includes(id)
                  ? prev.filter((x) => x !== id)
                  : prev.length >= 4
                    ? prev
                    : [...prev, id],
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
            emptyPool={
              q ? 'No films in your library match that search.' : 'No films in your library yet.'
            }
          />
          <FavoriteSide
            label="Favorite shows"
            slots={shows}
            onToggle={(id) =>
              setShows((prev) =>
                prev.includes(id)
                  ? prev.filter((x) => x !== id)
                  : prev.length >= 4
                    ? prev
                    : [...prev, id],
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
            emptyPool={
              q ? 'No shows in your library match that search.' : 'No shows in your library yet.'
            }
          />
        </div>
      )}
      {mut.isError && (
        <Notice className="mt-4">
          {mut.error instanceof ApiError ? mut.error.message : 'Could not save favorites'}
        </Notice>
      )}
    </Dialog>
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
        <h3 className="font-cond text-[13px] font-bold uppercase tracking-[0.12em] text-muted">
          {label}
        </h3>
        <span className="font-data text-[11px] text-muted-2">{slots.length}/4 selected</span>
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
                'relative aspect-[2/3] overflow-hidden rounded-sm border-2 border-dashed border-border bg-surface-2',
                item &&
                  'border-solid border-gold not-app:cursor-grab not-app:active:cursor-grabbing',
              )}
            >
              {item ? (
                <>
                  {item.posterUrl ? (
                    <img
                      src={item.posterUrl}
                      alt={item.title}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div
                      className="absolute inset-0"
                      style={{ background: posterGradient(item.title) }}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => onToggle(item.id)}
                    aria-label={`Remove ${item.title}`}
                    className="absolute right-0 top-0 grid h-8 w-8 place-items-center bg-bg-2/95 text-content hover:bg-surface-2"
                  >
                    <IconX className="h-3.5 w-3.5" />
                  </button>
                  {/* Drag works with a mouse only; these work everywhere. */}
                  <span className="absolute inset-x-0 bottom-0 flex justify-between">
                    {([-1, 1] as const).map((d) => {
                      const to = i + d;
                      const ok = to >= 0 && to < slots.length;
                      return (
                        <button
                          key={d}
                          type="button"
                          disabled={!ok}
                          onClick={() => onReorder(i, to)}
                          aria-label={`Move ${item.title} ${d < 0 ? 'earlier' : 'later'}`}
                          className="grid h-8 w-8 place-items-center bg-bg-2/95 text-content hover:bg-surface-2 disabled:invisible"
                        >
                          {d < 0 ? (
                            <IconChevronLeft className="h-3.5 w-3.5" />
                          ) : (
                            <IconChevronRight className="h-3.5 w-3.5" />
                          )}
                        </button>
                      );
                    })}
                  </span>
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
                type="button"
                aria-pressed={isSelected}
                title={item.title}
                onClick={() => onToggle(item.id)}
                className={cn(
                  'relative aspect-[2/3] overflow-hidden rounded-sm outline outline-2 outline-offset-2 outline-transparent',
                  isSelected && 'outline-gold',
                )}
              >
                {item.posterUrl ? (
                  <img
                    src={item.posterUrl}
                    alt={item.title}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div
                    className="absolute inset-0"
                    style={{ background: posterGradient(item.title) }}
                  />
                )}
                {isSelected && (
                  <span className="absolute right-0 top-0 grid h-5 w-5 place-items-center bg-gold font-data text-[11px] font-bold text-ink">
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
