import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import type { MediaDetail, SearchResult } from '@cinelog/contracts';
import { scaleForMediaType } from '@cinelog/contracts';
import { api, ApiError } from '../lib/api';
import { invalidateUserMedia } from '../lib/invalidate';
import { localDateString } from '../lib/format';
import { Dialog } from './Dialog';
import { PosterThumb } from './lb';
import { StarInput } from './Rating';
import { Button, buttonClass, Input, Notice, Spinner, StampToggle, Textarea, Checkbox } from './ui';

/**
 * The "+ Log" flow: pick a title, then record the watch, rating, and review in
 * one pass — the single action that covers most of what a member does here.
 *
 * Opens straight into the form when a title is already known (from its page),
 * otherwise starts on search.
 */
export function LogModal({
  media,
  onClose,
}: {
  media?: MediaDetail | null;
  onClose: () => void;
}): JSX.Element {
  const [picked, setPicked] = useState<{
    id: string;
    title: string;
    posterUrl: string | null;
  } | null>(media ? { id: media.id, title: media.title, posterUrl: media.posterUrl } : null);

  // Each step is its own sheet (they have different headers and footers), so
  // each renders the Dialog itself.
  return picked ? (
    <LogForm
      key={picked.id}
      mediaId={picked.id}
      title={picked.title}
      posterUrl={picked.posterUrl}
      onBack={media ? undefined : () => setPicked(null)}
      onClose={onClose}
      fromPage={!!media}
    />
  ) : (
    <PickTitle onPick={setPicked} onClose={onClose} />
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
  const [pickError, setPickError] = useState<string | null>(null);

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
    setPickError(null);
    try {
      const id =
        r.id ??
        (
          await api.resolveMedia({
            provider: r.provider,
            externalId: r.externalId,
            type: r.type,
          })
        ).id;
      onPick({ id, title: r.title, posterUrl: r.posterUrl });
    } catch (err) {
      setPickError(err instanceof ApiError ? err.message : 'Could not open that title.');
    } finally {
      setResolving(false);
    }
  }

  return (
    <Dialog
      title="Log a title"
      onClose={onClose}
      toolbar={
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="What did you watch?"
          aria-label="Search for a film or show"
          data-autofocus
        />
      }
    >
      {pickError && <Notice className="mb-3">{pickError}</Notice>}
      {resolving || isFetching ? (
        <Spinner center />
      ) : isError ? (
        <Notice>Search is unavailable. Check that TMDB is configured.</Notice>
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
                type="button"
                onClick={() => void pick(r)}
                className="flex w-full items-center gap-3 rounded-sm p-1.5 text-left hover:bg-surface-2"
              >
                <PosterThumb title={r.title} posterUrl={r.posterUrl} size="xs" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-content">{r.title}</span>
                  {r.year && (
                    <span className="block font-data text-[11px] text-muted-2">{r.year}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}

function LogForm({
  mediaId,
  title,
  posterUrl,
  onBack,
  onClose,
  fromPage,
}: {
  mediaId: string;
  title: string;
  posterUrl: string | null;
  onBack?: () => void;
  onClose: () => void;
  /** Opened from the title's own page — just close on save; that page shows the result. */
  fromPage: boolean;
}): JSX.Element {
  const queryClient = useQueryClient();

  const { data: detail } = useQuery({
    queryKey: ['media', mediaId],
    queryFn: () => api.getMedia(mediaId),
  });

  const today = localDateString();
  const [watchedDate, setWatchedDate] = useState(today);
  const [rating, setRating] = useState<number | null>(null);
  const [review, setReview] = useState('');
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [isRewatch, setIsRewatch] = useState(false);
  const [liked, setLiked] = useState(false);
  // Off = "I've seen this, but not on a day I want in the diary".
  const [toDiary, setToDiary] = useState(true);
  const [saved, setSaved] = useState(false);
  // What the member already had when the form opened; only differences are sent.
  const [base, setBase] = useState<{ rating: number | null; liked: boolean } | null>(null);
  // Steps that already succeeded, so a retry after a partial failure doesn't
  // write a second diary entry.
  const done = useRef(new Set<'watch' | 'rating' | 'like' | 'review'>());

  // Prefill once per opened title — a background refetch of the media query
  // must not overwrite what the member has typed since.
  useEffect(() => {
    if (!detail || base) return;
    setBase({ rating: detail.userState.rating, liked: detail.userState.isFavorite });
    setRating((r) => r ?? detail.userState.rating);
    setLiked(detail.userState.isFavorite);
    if (detail.ownReview) {
      setReview(detail.ownReview.body);
      setIsSpoiler(detail.ownReview.isSpoiler);
    }
  }, [detail, base]);

  const scale = detail ? scaleForMediaType(detail.type) : 'TEN';

  const mut = useMutation({
    mutationFn: async () => {
      if (!detail || !base) return;
      const own = detail.ownReview;
      // Ordered so the diary entry exists before the review that references the
      // same watch; each completed step is skipped on retry.
      if (!done.current.has('watch')) {
        if (toDiary) {
          await api.markWatched({
            mediaId,
            // Date-only on the server (stored at 12:00 UTC), so send that instant.
            watchedAt: `${watchedDate}T12:00:00.000Z`,
            isRewatch,
          });
        } else if (rating === null && detail.userState.status !== 'COMPLETED') {
          // No diary entry: just make sure it counts as watched. A rating does
          // that by itself, so this is only for the unrated case.
          await api.setStatus({ mediaId }, 'COMPLETED');
        }
        done.current.add('watch');
      }
      if (!done.current.has('rating') && rating !== base.rating) {
        await api.setRating({ mediaId }, rating);
        done.current.add('rating');
      }
      if (!done.current.has('like') && liked !== base.liked) {
        await api.setFavorite({ mediaId }, liked);
        done.current.add('like');
      }
      const body = review.trim();
      const reviewChanged =
        !own || body !== own.body.trim() || isSpoiler !== own.isSpoiler || rating !== base.rating;
      if (!done.current.has('review') && body && reviewChanged) {
        // The server snapshots the current rating onto the review.
        if (own) await api.updateReview(own.id, { body, isSpoiler });
        else await api.createReview(mediaId, { targetType: 'MEDIA', body, isSpoiler });
        done.current.add('review');
      }
    },
    onSuccess: () => {
      invalidateUserMedia(queryClient, mediaId);
      if (fromPage) onClose();
      else setSaved(true);
    },
    // Partial progress still changed things; refresh whatever did save.
    onError: () => invalidateUserMedia(queryClient, mediaId),
  });

  if (saved) {
    return (
      <Dialog
        title="Logged"
        size="sm"
        onClose={onClose}
        footer={
          <>
            <Link to={`/media/${mediaId}`} onClick={onClose} className={buttonClass()}>
              View title
            </Link>
            <Button variant="primary" data-autofocus onClick={onClose}>
              Done
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          <span className="text-content">{title}</span>{' '}
          {toDiary ? 'is in your diary.' : 'is marked as watched.'}
        </p>
      </Dialog>
    );
  }

  return (
    <Dialog
      title={`Log ${title}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={mut.isPending || !base} onClick={() => mut.mutate()}>
            {mut.isPending ? 'Saving…' : toDiary ? 'Save log' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-start gap-4">
          <PosterThumb title={title} posterUrl={posterUrl} size="lg" />
          <div className="min-w-0 flex-1 space-y-3">
            {onBack && (
              <Button variant="link" size="sm" onClick={onBack}>
                Pick a different title
              </Button>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <Checkbox
                checked={toDiary}
                onChange={(e) => setToDiary(e.target.checked)}
                className="!text-content"
              >
                <span className={LABEL}>
                  {toDiary ? 'Add to diary — watched on' : 'Add to diary'}
                </span>
              </Checkbox>
              {toDiary && (
                <Input
                  type="date"
                  value={watchedDate}
                  max={today}
                  onChange={(e) => setWatchedDate(e.target.value)}
                  aria-label="Watched on"
                  className="h-9 w-auto font-data coarse:h-11"
                />
              )}
            </div>
            <div className="-ml-2 flex flex-wrap gap-1">
              {toDiary && (
                <StampToggle
                  label="Rewatch"
                  tone="cyan"
                  active={isRewatch}
                  onChange={setIsRewatch}
                />
              )}
              <StampToggle label="Liked" tone="rose" active={liked} onChange={setLiked} />
            </div>
          </div>
        </div>

        <div>
          <p className={LABEL}>Rating</p>
          <StarInput value={rating} scale={scale} onChange={setRating} className="-ml-2 mt-1" />
        </div>

        <div>
          <label htmlFor="log-review" className={LABEL}>
            Review <span className="font-normal normal-case tracking-normal">(optional)</span>
          </label>
          <Textarea
            id="log-review"
            value={review}
            onChange={(e) => setReview(e.target.value.slice(0, 10000))}
            placeholder="What did you think?"
            className="mt-1.5"
          />
          {review.trim() && (
            <Checkbox
              className="mt-2"
              checked={isSpoiler}
              onChange={(e) => setIsSpoiler(e.target.checked)}
            >
              Contains spoilers
            </Checkbox>
          )}
        </div>

        {mut.isError && (
          <Notice>
            {mut.error instanceof ApiError ? mut.error.message : 'Could not save your log'}
          </Notice>
        )}
      </div>
    </Dialog>
  );
}

const LABEL = 'block font-cond text-[11px] font-bold uppercase tracking-[0.12em] text-muted-2';

/**
 * The manifest's "Log a title" shortcut launches at `/?log=1`. Both shells call
 * this: it opens the log modal and strips the flag so a refresh doesn't reopen it.
 */
export function useLogShortcut(setOpen: (open: boolean) => void): void {
  const [search, setSearch] = useSearchParams();
  useEffect(() => {
    if (search.get('log') !== '1') return;
    setOpen(true);
    const next = new URLSearchParams(search);
    next.delete('log');
    setSearch(next, { replace: true });
  }, [search, setSearch, setOpen]);
}
