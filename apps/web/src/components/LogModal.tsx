import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { MediaDetail, SearchResult } from '@cinelog/contracts';
import { scaleForMediaType } from '@cinelog/contracts';
import { api, ApiError } from '../lib/api';
import { posterGradient } from '../lib/poster';
import { RatingWidget } from './RatingWidget';
import { Button, Input, Spinner } from './ui';

/**
 * The "+ Log" flow: pick a title, then record the watch, rating, and review in
 * one pass — the single action that covers most of what a member does here.
 *
 * Opens straight into the form when a title is already known (from a film page),
 * otherwise starts on search.
 */
export function LogModal({
  media,
  onClose,
}: {
  media?: MediaDetail | null;
  onClose: () => void;
}): JSX.Element {
  const [picked, setPicked] = useState<{ id: string; title: string; posterUrl: string | null } | null>(
    media ? { id: media.id, title: media.title, posterUrl: media.posterUrl } : null,
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={picked ? `Log ${picked.title}` : 'Log a film'}
        onClick={(e) => e.stopPropagation()}
        className="my-auto w-full max-w-lg rounded-2xl border border-border bg-surface shadow-soft"
      >
        {picked ? (
          <LogForm
            mediaId={picked.id}
            title={picked.title}
            posterUrl={picked.posterUrl}
            onBack={media ? undefined : () => setPicked(null)}
            onClose={onClose}
          />
        ) : (
          <PickTitle onPick={setPicked} onClose={onClose} />
        )}
      </div>
    </div>
  );
}

function PickTitle({
  onPick,
  onClose,
}: {
  onPick: (m: { id: string; title: string; posterUrl: string | null }) => void;
  onClose: () => void;
}): JSX.Element {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isFetching, isError } = useQuery({
    queryKey: ['search', debounced],
    queryFn: () => api.search(debounced),
    enabled: debounced.length > 1,
  });

  async function pick(r: SearchResult): Promise<void> {
    setResolving(true);
    try {
      const id = r.id ?? (await api.resolveMedia({
        provider: r.provider,
        externalId: r.externalId,
        type: r.type,
      })).id;
      onPick({ id, title: r.title, posterUrl: r.posterUrl });
    } finally {
      setResolving(false);
    }
  }

  return (
    <>
      <div className="border-b border-border p-4">
        <h2 className="mb-3 font-cond text-lg font-extrabold uppercase tracking-tight">
          What did you watch?
        </h2>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search for a film or show…"
          autoFocus
        />
      </div>

      <div className="max-h-[50vh] overflow-y-auto p-4">
        {resolving || isFetching ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : isError ? (
          <p className="py-6 text-center text-sm text-rose">
            Search is unavailable. Check that TMDB is configured.
          </p>
        ) : debounced.length < 2 ? (
          <p className="py-6 text-center text-sm text-muted-2">
            Type at least two characters to search.
          </p>
        ) : (data?.results.length ?? 0) === 0 ? (
          <p className="py-6 text-center text-sm text-muted">No results.</p>
        ) : (
          <ul className="space-y-1">
            {data?.results.slice(0, 20).map((r) => (
              <li key={`${r.provider}:${r.externalId}`}>
                <button
                  onClick={() => void pick(r)}
                  className="flex w-full items-center gap-3 rounded p-1.5 text-left hover:bg-surface-2"
                >
                  <span className="h-14 w-10 shrink-0 overflow-hidden rounded-[2px] bg-surface-2">
                    {r.posterUrl ? (
                      <img src={r.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <span
                        className="block h-full w-full"
                        style={{ background: posterGradient(r.title) }}
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-content">{r.title}</span>
                    {r.year && <span className="block text-xs text-muted-2">{r.year}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex justify-end border-t border-border p-4">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </>
  );
}

function LogForm({
  mediaId,
  title,
  posterUrl,
  onBack,
  onClose,
}: {
  mediaId: string;
  title: string;
  posterUrl: string | null;
  onBack?: () => void;
  onClose: () => void;
}): JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: detail } = useQuery({
    queryKey: ['media', mediaId],
    queryFn: () => api.getMedia(mediaId),
  });

  const today = new Date().toISOString().slice(0, 10);
  const [watchedDate, setWatchedDate] = useState(today);
  const [rating, setRating] = useState<number | null>(null);
  const [review, setReview] = useState('');
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [isRewatch, setIsRewatch] = useState(false);
  const [liked, setLiked] = useState(false);

  // Prefill from any existing state once the detail loads, so logging again
  // doesn't silently discard a rating the member already gave.
  useEffect(() => {
    if (detail) {
      setRating((r) => (r === null ? detail.userState.rating : r));
      setLiked(detail.userState.isFavorite);
    }
  }, [detail]);

  const scale = detail ? scaleForMediaType(detail.type) : 'TEN';

  const mut = useMutation({
    mutationFn: async () => {
      // Ordered so the diary entry exists before the review that references the
      // same watch; each call is independent and safe to run on its own.
      await api.markWatched({
        mediaId,
        watchedAt: new Date(`${watchedDate}T12:00:00`).toISOString(),
        isRewatch,
      });
      if (rating !== null) await api.setRating({ mediaId }, rating);
      if (liked !== (detail?.userState.isFavorite ?? false)) {
        await api.setFavorite({ mediaId }, liked);
      }
      if (review.trim()) {
        const existing = detail?.reviewCount ? await findOwnReview(mediaId) : null;
        if (existing) {
          await api.updateReview(existing, { body: review, isSpoiler });
        } else {
          await api.createReview(mediaId, { targetType: 'MEDIA', body: review, isSpoiler });
        }
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['media', mediaId] });
      void queryClient.invalidateQueries({ queryKey: ['library'] });
      void queryClient.invalidateQueries({ queryKey: ['activity'] });
      void queryClient.invalidateQueries({ queryKey: ['reviews', mediaId] });
      onClose();
      navigate(`/media/${mediaId}`);
    },
  });

  return (
    <>
      <div className="flex items-start gap-4 border-b border-border p-4">
        <div className="h-24 w-16 shrink-0 overflow-hidden rounded ring-1 ring-border-hi/50">
          {posterUrl ? (
            <img src={posterUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="block h-full w-full" style={{ background: posterGradient(title) }} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-cond text-xl font-extrabold uppercase leading-tight tracking-tight">
            {title}
          </h2>
          {onBack && (
            <button onClick={onBack} className="mt-1 text-xs text-muted-2 hover:text-content">
              ← Pick a different title
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-muted">
            <span className="font-cond text-[11px] font-bold uppercase tracking-[0.12em] text-muted-2">
              Watched
            </span>
            <input
              type="date"
              value={watchedDate}
              max={today}
              onChange={(e) => setWatchedDate(e.target.value)}
              className="h-9 rounded border border-border bg-surface-2 px-2.5 text-sm text-content focus:border-transparent focus:outline-none focus:ring-2 focus:ring-cyan/50"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={isRewatch}
              onChange={(e) => setIsRewatch(e.target.checked)}
            />
            Rewatch
          </label>
          <button
            onClick={() => setLiked((v) => !v)}
            aria-pressed={liked}
            className={`text-lg leading-none ${liked ? 'text-rose' : 'text-muted-2 hover:text-rose'}`}
            title={liked ? 'Liked' : 'Like'}
          >
            {liked ? '♥' : '♡'}
          </button>
        </div>

        <div>
          <p className="mb-1.5 font-cond text-[11px] font-bold uppercase tracking-[0.12em] text-muted-2">
            Rating
          </p>
          <RatingWidget value={rating} scale={scale} onChange={setRating} />
        </div>

        <div>
          <p className="mb-1.5 font-cond text-[11px] font-bold uppercase tracking-[0.12em] text-muted-2">
            Review <span className="normal-case tracking-normal text-muted-2">(optional)</span>
          </p>
          <textarea
            value={review}
            onChange={(e) => setReview(e.target.value.slice(0, 10000))}
            rows={4}
            placeholder="What did you think?"
            className="w-full resize-none rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-content placeholder:text-muted-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-cyan/50"
          />
          {review.trim() && (
            <label className="mt-2 flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={isSpoiler}
                onChange={(e) => setIsSpoiler(e.target.checked)}
              />
              Contains spoilers
            </label>
          )}
        </div>

        {mut.isError && (
          <p className="rounded-lg border border-rose/30 bg-rose/10 px-3 py-2 text-sm text-rose">
            {mut.error instanceof ApiError ? mut.error.message : 'Could not save your log'}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-border p-4">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" disabled={mut.isPending} onClick={() => mut.mutate()}>
          {mut.isPending ? 'Saving…' : 'Save log'}
        </Button>
      </div>
    </>
  );
}

/** Find the viewer's own review id for a title, if they already wrote one. */
async function findOwnReview(mediaId: string): Promise<string | null> {
  const page = await api.getReviews(mediaId, 'RECENT');
  return page.reviews.find((r) => r.isOwnReview)?.id ?? null;
}
