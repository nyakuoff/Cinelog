import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Review, ReviewSort } from '@cinelog/contracts';
import { fromNormalized, type RatingScale } from '@cinelog/contracts';
import { api, ApiError } from '../lib/api';
import { cn } from '../lib/cn';
import { Avatar } from './Avatar';
import { Button, Spinner } from './ui';

const SORTS: { value: ReviewSort; label: string }[] = [
  { value: 'POPULAR', label: 'Popular' },
  { value: 'RECENT', label: 'Recent' },
  { value: 'HIGHEST', label: 'Highest rated' },
  { value: 'LOWEST', label: 'Lowest rated' },
  { value: 'FOLLOWING', label: 'People you follow' },
];

export function ReviewsSection({ mediaId, scale }: { mediaId: string; scale: RatingScale }): JSX.Element {
  const [sort, setSort] = useState<ReviewSort>('POPULAR');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['reviews', mediaId, sort],
    queryFn: () => api.getReviews(mediaId, sort),
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['reviews', mediaId] });
  };

  const ownReview = data?.reviews.find((r) => r.isOwnReview) ?? null;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-cond text-[15px] font-extrabold uppercase tracking-[0.08em] text-muted">
          Reviews
        </h2>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as ReviewSort)}
          className="h-8 rounded-lg border border-border bg-surface-2 px-2.5 text-[13px] text-content focus:border-transparent focus:outline-none focus:ring-2 focus:ring-cyan/50"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              Sort: {s.label}
            </option>
          ))}
        </select>
      </div>

      <ReviewComposer mediaId={mediaId} scale={scale} existing={ownReview} onSaved={invalidate} />

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : (data?.reviews.length ?? 0) === 0 ? (
        <p className="py-6 text-sm text-muted">No reviews yet — be the first.</p>
      ) : (
        <div className="mt-6 space-y-6">
          {data?.reviews.map((r) => (
            <ReviewCard key={r.id} review={r} scale={scale} onChanged={invalidate} />
          ))}
        </div>
      )}
    </section>
  );
}

function ReviewComposer({
  mediaId,
  scale,
  existing,
  onSaved,
}: {
  mediaId: string;
  scale: RatingScale;
  existing: Review | null;
  onSaved: () => void;
}): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(existing?.body ?? '');
  const [isSpoiler, setIsSpoiler] = useState(existing?.isSpoiler ?? false);

  const mut = useMutation({
    mutationFn: () =>
      existing
        ? api.updateReview(existing.id, { body, isSpoiler })
        : api.createReview(mediaId, { targetType: 'MEDIA', body, isSpoiler }),
    onSuccess: () => {
      setEditing(false);
      onSaved();
    },
  });

  if (!editing && !existing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="mb-6 w-full rounded-xl border border-dashed border-border bg-surface-2 px-4 py-3 text-left text-sm text-muted hover:border-cyan hover:text-content"
      >
        Write a review…
      </button>
    );
  }

  if (!editing && existing) {
    return (
      <div className="mb-6 flex items-center justify-between rounded-xl border border-border bg-surface-2 px-4 py-3">
        <p className="text-sm text-muted">You already reviewed this title.</p>
        <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
          Edit your review
        </Button>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-border bg-surface-2 p-4">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, 10000))}
        rows={4}
        placeholder="What did you think?"
        className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content placeholder:text-muted-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-cyan/50"
      />
      <div className="mt-2 flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={isSpoiler} onChange={(e) => setIsSpoiler(e.target.checked)} />
          Contains spoilers
        </label>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditing(false);
              setBody(existing?.body ?? '');
            }}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            disabled={mut.isPending || body.trim().length === 0}
            onClick={() => mut.mutate()}
          >
            {mut.isPending ? 'Saving…' : existing ? 'Save' : 'Post review'}
          </Button>
        </div>
      </div>
      {mut.isError && (
        <p className="mt-2 text-xs text-rose">
          {mut.error instanceof ApiError ? mut.error.message : 'Could not save review'}
        </p>
      )}
    </div>
  );
}

function ReviewCard({
  review,
  scale,
  onChanged,
}: {
  review: Review;
  scale: RatingScale;
  onChanged: () => void;
}): JSX.Element {
  const [revealedBody, setRevealedBody] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [liked, setLiked] = useState(review.likedByViewer);
  const [likeCount, setLikeCount] = useState(review.likeCount);

  const likeMut = useMutation({
    mutationFn: (next: boolean) => (next ? api.likeReview(review.id) : api.unlikeReview(review.id)),
    onMutate: (next: boolean) => {
      const prev = { liked, likeCount };
      setLiked(next);
      setLikeCount((c) => c + (next ? 1 : -1));
      return prev;
    },
    onError: (_err, _next, prev) => {
      if (prev) {
        setLiked(prev.liked);
        setLikeCount(prev.likeCount);
      }
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => api.deleteReview(review.id),
    onSuccess: onChanged,
  });

  const showConcealed = review.concealed && revealedBody === null;

  async function reveal(): Promise<void> {
    const full = await api.getReview(review.id);
    setRevealedBody(full.body);
  }

  return (
    <div className="border-b border-border pb-6 last:border-0">
      <div className="flex items-start gap-3">
        <Avatar user={{ username: review.author.username, avatarUrl: review.author.avatarUrl }} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-content">
              {review.author.displayName || review.author.username}
            </span>
            {review.ratingValue !== null && (
              <span className="text-xs font-semibold text-gold">
                {fromNormalized(review.ratingValue, scale)}
              </span>
            )}
            <span className="text-xs text-muted-2">
              {new Date(review.createdAt).toLocaleDateString()}
              {review.editedAt && ' · edited'}
            </span>
          </div>

          {showConcealed ? (
            <button
              onClick={() => void reveal()}
              className="mt-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-muted hover:text-content"
            >
              Contains spoilers — click to reveal
            </button>
          ) : (
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-content/90">
              {revealedBody ?? review.body}
            </p>
          )}

          <div className="mt-2 flex items-center gap-4 text-xs text-muted">
            <button
              onClick={() => likeMut.mutate(!liked)}
              className={cn('flex items-center gap-1 hover:text-content', liked && 'text-rose')}
            >
              {liked ? '♥' : '♡'} {likeCount}
            </button>
            <button onClick={() => setShowComments((v) => !v)} className="hover:text-content">
              💬 {review.commentCount}
            </button>
            {review.isOwnReview && (
              <button
                onClick={() => {
                  if (confirm('Delete this review?')) deleteMut.mutate();
                }}
                className="hover:text-rose"
              >
                Delete
              </button>
            )}
          </div>

          {showComments && <ReviewComments reviewId={review.id} />}
        </div>
      </div>
    </div>
  );
}

function ReviewComments({ reviewId }: { reviewId: string }): JSX.Element {
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['review-comments', reviewId],
    queryFn: () => api.getReviewComments(reviewId),
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['review-comments', reviewId] });
    void queryClient.invalidateQueries({ queryKey: ['reviews'] });
  };

  const addMut = useMutation({
    mutationFn: () => api.addReviewComment(reviewId, { body }),
    onSuccess: () => {
      setBody('');
      invalidate();
    },
  });
  const deleteMut = useMutation({
    mutationFn: (commentId: string) => api.deleteReviewComment(reviewId, commentId),
    onSuccess: invalidate,
  });

  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      {isLoading ? (
        <Spinner className="h-4 w-4" />
      ) : (
        data?.comments.map((c) => (
          <div key={c.id} className="flex items-start gap-2">
            <Avatar user={{ username: c.author.username, avatarUrl: c.author.avatarUrl }} size={24} />
            <div className="min-w-0 flex-1">
              <p className="text-xs">
                <span className="font-medium text-content">
                  {c.author.displayName || c.author.username}
                </span>{' '}
                <span className="text-muted-2">{new Date(c.createdAt).toLocaleDateString()}</span>
              </p>
              <p className="text-sm text-content/90">{c.body}</p>
            </div>
            {c.isOwnComment && (
              <button
                onClick={() => deleteMut.mutate(c.id)}
                className="text-xs text-muted-2 hover:text-rose"
              >
                Delete
              </button>
            )}
          </div>
        ))
      )}
      <div className="flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, 2000))}
          placeholder="Add a comment…"
          className="h-8 flex-1 rounded-lg border border-border bg-surface-2 px-2.5 text-sm text-content placeholder:text-muted-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-cyan/50"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && body.trim()) addMut.mutate();
          }}
        />
        <Button size="sm" variant="secondary" disabled={!body.trim() || addMut.isPending} onClick={() => addMut.mutate()}>
          Post
        </Button>
      </div>
    </div>
  );
}
