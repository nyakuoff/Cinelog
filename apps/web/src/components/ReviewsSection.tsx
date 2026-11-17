import { useEffect, useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MediaDetail, Review, ReviewSort, UserReview } from '@cinelog/contracts';
import type { RatingScale } from '@cinelog/contracts';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { cn } from '../lib/cn';
import { Avatar } from './Avatar';
import { IconComment, IconHeart } from './app/Icons';
import { useConfirm } from './Dialog';
import { DateText, EmptyState, isEpisodic, mediaHref, PosterThumb, SectionHeader } from './lb';
import { RatingMark } from './Rating';
import { Button, Checkbox, Input, LoadMore, Notice, Select, Spinner, Textarea } from './ui';

const SORTS: { value: ReviewSort; label: string }[] = [
  { value: 'POPULAR', label: 'Popular' },
  { value: 'RECENT', label: 'Recent' },
  { value: 'HIGHEST', label: 'Highest rated' },
  { value: 'LOWEST', label: 'Lowest rated' },
];

export function ReviewsSection({
  mediaId,
  scale,
  ownReview,
}: {
  mediaId: string;
  scale: RatingScale;
  /** From the media detail — the viewer's own review regardless of which page it sorts onto. */
  ownReview: MediaDetail['ownReview'];
}): JSX.Element {
  const [sort, setSort] = useState<ReviewSort>('POPULAR');
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: ['reviews', mediaId, sort],
    queryFn: ({ pageParam }) => api.getReviews(mediaId, sort, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const { isLoading } = query;
  const reviews = query.data?.pages.flatMap((p) => p.reviews) ?? [];
  // People you follow get their own shelf above everyone else's, the way a
  // Letterboxd film page leads with friends.
  const friends = useInfiniteQuery({
    queryKey: ['reviews', mediaId, 'FOLLOWING'],
    queryFn: ({ pageParam }) => api.getReviews(mediaId, 'FOLLOWING', pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const friendReviews = friends.data?.pages.flatMap((p) => p.reviews) ?? [];

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['reviews', mediaId] });
    // ownReview and reviewCount live on the media detail.
    void queryClient.invalidateQueries({ queryKey: ['media', mediaId] });
    void queryClient.invalidateQueries({ queryKey: ['profile'] });
    void queryClient.invalidateQueries({ queryKey: ['activity'] });
  };

  return (
    <section>
      {/* Keyed by review id so the form re-seeds from the saved review rather
          than keeping whatever it held before that review existed. */}
      <ReviewComposer
        key={ownReview?.id ?? 'new'}
        mediaId={mediaId}
        existing={ownReview}
        onSaved={invalidate}
      />

      {friendReviews.length > 0 && (
        <div className="mb-10">
          <SectionHeader title="Reviews from friends" count={friendReviews.length} />
          <div className="space-y-6">
            {friendReviews.map((r) => (
              <ReviewCard key={r.id} review={r} scale={scale} onChanged={invalidate} />
            ))}
          </div>
          <LoadMore query={friends} />
        </div>
      )}

      <SectionHeader
        title={sort === 'POPULAR' ? 'Popular reviews' : 'Reviews'}
        right={
          <Select
            value={sort}
            onChange={(e) => setSort(e.target.value as ReviewSort)}
            aria-label="Sort reviews"
          >
            {SORTS.map((o) => (
              <option key={o.value} value={o.value}>
                Sort: {o.label}
              </option>
            ))}
          </Select>
        }
      />
      {isLoading ? (
        <Spinner center />
      ) : reviews.length === 0 ? (
        <EmptyState compact title="No reviews yet" body="Be the first to write one." />
      ) : (
        <>
          <div className="space-y-6">
            {reviews.map((r) => (
              <ReviewCard key={r.id} review={r} scale={scale} onChanged={invalidate} />
            ))}
          </div>
          <LoadMore query={query} />
        </>
      )}
    </section>
  );
}

function ReviewComposer({
  mediaId,
  existing,
  onSaved,
}: {
  mediaId: string;
  existing: MediaDetail['ownReview'];
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

  if (!editing) {
    return (
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-border bg-surface px-4 py-3">
        <p className="text-sm text-muted">
          {existing ? 'You already reviewed this title.' : 'Seen it? Say what you thought.'}
        </p>
        <Button size="sm" onClick={() => setEditing(true)}>
          {existing ? 'Edit your review' : 'Write a review'}
        </Button>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-sm border border-border bg-surface p-4">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, 10000))}
        placeholder="What did you think?"
        aria-label="Your review"
        autoFocus
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <Checkbox checked={isSpoiler} onChange={(e) => setIsSpoiler(e.target.checked)}>
          Contains spoilers
        </Checkbox>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditing(false);
              setBody(existing?.body ?? '');
              setIsSpoiler(existing?.isSpoiler ?? false);
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
        <Notice className="mt-3">
          {mut.error instanceof ApiError ? mut.error.message : 'Could not save review'}
        </Notice>
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
  const confirm = useConfirm();
  const [revealedBody, setRevealedBody] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false);
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
        <Link to={`/u/${review.author.username}`} className="shrink-0">
          <Avatar
            user={{ username: review.author.username, avatarUrl: review.author.avatarUrl }}
            size={36}
          />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <Link
              to={`/u/${review.author.username}`}
              className="text-sm font-medium text-content hover:text-gold"
            >
              {review.author.displayName || review.author.username}
            </Link>
            {review.ratingValue !== null && (
              <RatingMark value={review.ratingValue} scale={scale} size={12} />
            )}
            <Link to={`/review/${review.id}`} title="Open this review" className="hover:underline">
              <DateText iso={review.createdAt} />
            </Link>
            {review.editedAt && <span className="font-data text-[11px] text-muted-2">edited</span>}
          </div>

          {showConcealed ? (
            <Button size="sm" className="mt-2" onClick={() => void reveal()}>
              Spoilers — reveal
            </Button>
          ) : (
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-content/90">
              {revealedBody ?? review.body}
            </p>
          )}

          <div className="mt-1 flex items-center gap-1">
            <ReviewLikeButton review={review} className="-ml-3" />
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={showComments}
              aria-label="Comments"
              onClick={() => setShowComments((v) => !v)}
            >
              <IconComment />
              <span className="font-data tracking-normal">{review.commentCount}</span>
            </Button>
            {review.isOwnReview && (
              <Button
                variant="link"
                size="sm"
                className="ml-2"
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Delete this review?',
                    confirmLabel: 'Delete review',
                    danger: true,
                  });
                  if (ok) deleteMut.mutate();
                }}
              >
                Delete
              </Button>
            )}
          </div>

          {showComments && <ReviewComments reviewId={review.id} />}
        </div>
      </div>
    </div>
  );
}

export function ReviewComments({ reviewId }: { reviewId: string }): JSX.Element {
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['review-comments', reviewId],
    queryFn: () => api.getReviewComments(reviewId),
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['review-comments', reviewId] });
    void queryClient.invalidateQueries({ queryKey: ['reviews'] });
    void queryClient.invalidateQueries({ queryKey: ['review', reviewId] });
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
            <Avatar
              user={{ username: c.author.username, avatarUrl: c.author.avatarUrl }}
              size={24}
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs">
                <span className="font-medium text-content">
                  {c.author.displayName || c.author.username}
                </span>{' '}
                <DateText iso={c.createdAt} />
              </p>
              <p className="text-sm text-content/90">{c.body}</p>
            </div>
            {c.isOwnComment && (
              <Button variant="link" size="sm" onClick={() => deleteMut.mutate(c.id)}>
                Delete
              </Button>
            )}
          </div>
        ))
      )}
      <div className="flex gap-2">
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, 2000))}
          placeholder="Add a comment…"
          aria-label="Add a comment"
          className="h-8 flex-1 coarse:h-10"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && body.trim() && !addMut.isPending) addMut.mutate();
          }}
        />
        <Button
          size="sm"
          variant="secondary"
          disabled={!body.trim() || addMut.isPending}
          onClick={() => addMut.mutate()}
        >
          Post
        </Button>
      </div>
    </div>
  );
}

/** The heart on a review: optimistic, rolled back if the server says no. */
export function ReviewLikeButton({
  review,
  className,
}: {
  review: Pick<Review, 'id' | 'likedByViewer' | 'likeCount'>;
  className?: string;
}): JSX.Element {
  const [liked, setLiked] = useState(review.likedByViewer);
  const [likeCount, setLikeCount] = useState(review.likeCount);
  // Follow the server when a refetch brings different values (liked elsewhere).
  useEffect(() => {
    setLiked(review.likedByViewer);
    setLikeCount(review.likeCount);
  }, [review.likedByViewer, review.likeCount]);
  const queryClient = useQueryClient();
  const mut = useMutation({
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
    // Other copies of this review (its page, the title's list, Home, profile
    // likes) are cached separately; refresh them so none shows the old state.
    onSettled: () => {
      for (const queryKey of [['reviews'], ['review', review.id], ['profile'], ['home']]) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-pressed={liked}
      aria-label={liked ? 'Unlike review' : 'Like review'}
      onClick={() => mut.mutate(!liked)}
      className={cn(className, liked && '!text-rose')}
    >
      <IconHeart filled={liked} />
      <span className="font-data tracking-normal">{likeCount}</span>
    </Button>
  );
}

/**
 * A review away from its title's page — on Home, a profile, a likes list — so
 * it carries the poster and title it is about. The whole thing leads to the
 * review's own page, which is where it is liked and answered.
 */
export function UserReviewCard({
  review: r,
  showAuthor = true,
}: {
  review: UserReview;
  /** Off on the author's own profile, where every row would repeat them. */
  showAuthor?: boolean;
}): JSX.Element {
  const to = `/review/${r.id}`;
  return (
    <article className="flex items-start gap-3.5 py-4">
      <PosterThumb
        title={r.media.title}
        posterUrl={r.media.posterUrl}
        to={mediaHref(r.media)}
        size="lg"
      />
      <div className="min-w-0 flex-1">
        <Link to={to} className="group block">
          <span className="font-cond text-[17px] font-extrabold uppercase leading-tight tracking-[0.02em] text-content group-hover:text-gold">
            {r.media.title}
          </span>
          {r.media.year && (
            <span className="ml-2 font-data text-[13px] text-muted-2">{r.media.year}</span>
          )}
        </Link>
        <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm">
          {showAuthor && (
            <Link
              to={`/u/${r.author.username}`}
              className="flex items-center gap-1.5 text-muted hover:text-content"
            >
              <Avatar
                user={{ username: r.author.username, avatarUrl: r.author.avatarUrl }}
                size={18}
              />
              {r.author.displayName || r.author.username}
            </Link>
          )}
          {r.ratingValue !== null && (
            <RatingMark
              value={r.ratingValue}
              type={r.media.type}
              size={12}
              display={isEpisodic(r.media.type) ? 'number' : 'stars'}
            />
          )}
          <DateText iso={r.watchedDate ?? r.createdAt} dateOnly={!!r.watchedDate} />
        </p>
        {r.concealed ? (
          <Link to={to} className="mt-2 inline-block text-sm italic text-muted hover:text-content">
            This review contains spoilers — read it anyway
          </Link>
        ) : (
          <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-content/90">
            {r.body}
          </p>
        )}
        <Link
          to={to}
          className="mt-2 flex w-fit items-center gap-3 font-data text-[11px] text-muted-2 hover:text-content"
        >
          <span className={cn('flex items-center gap-1', r.likedByViewer && 'text-rose')}>
            <IconHeart filled={r.likedByViewer} className="h-3.5 w-3.5" /> {r.likeCount}
          </span>
          <span className="flex items-center gap-1">
            <IconComment className="h-3.5 w-3.5" /> {r.commentCount}
          </span>
        </Link>
      </div>
    </article>
  );
}
