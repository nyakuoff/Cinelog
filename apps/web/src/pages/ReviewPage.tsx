import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useGoBack, useScreenHeader } from '../lib/appShell';
import { Avatar } from '../components/Avatar';
import { useConfirm } from '../components/Dialog';
import { ReviewComments, ReviewLikeButton } from '../components/ReviewsSection';
import { RatingMark } from '../components/Rating';
import {
  DateText,
  EmptyState,
  ErrorState,
  isEpisodic,
  mediaHref,
  Poster,
  SectionHeader,
} from '../components/lb';
import { Button, Spinner } from '../components/ui';

/** A single review at its own address (`/review/:id`) — what a diary's review
 *  mark, a feed row and a review card all link to. */
export function ReviewPage(): JSX.Element {
  const { id = '' } = useParams();
  const goBack = useGoBack();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [revealed, setRevealed] = useState(false);

  const {
    data: r,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['review', id],
    queryFn: () => api.getReview(id),
    enabled: id.length > 0,
    retry: false,
  });

  useScreenHeader({
    title: r ? `${r.author.displayName || r.author.username}’s review` : 'Review',
    back: true,
  });

  const remove = useMutation({
    mutationFn: () => api.deleteReview(id),
    onSuccess: () => {
      for (const queryKey of [
        ['reviews'],
        ['media', r?.mediaId],
        ['profile'],
        ['activity'],
        ['home'],
      ]) {
        void queryClient.invalidateQueries({ queryKey });
      }
      goBack();
    },
  });

  if (isLoading) return <Spinner center />;
  if (!r) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        {error instanceof ApiError && (error.status === 404 || error.status === 403) ? (
          <EmptyState
            title="Review not found"
            body="It may have been deleted, or its author's profile is private."
          />
        ) : (
          <ErrorState title="Could not load this review" onRetry={() => void refetch()} />
        )}
      </div>
    );
  }

  const name = r.author.displayName || r.author.username;
  const hidden = r.isSpoiler && !r.isOwnReview && !revealed;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 app:py-4 sm:px-6">
      <div className="flex items-start gap-5">
        <Poster
          title={r.media.title}
          year={r.media.year}
          posterUrl={r.media.posterUrl}
          to={mediaHref(r.media)}
          className="!w-24 shrink-0 sm:!w-36"
          priority
        />
        <div className="min-w-0 flex-1">
          <Link
            to={`/u/${r.author.username}`}
            className="flex w-fit items-center gap-2 text-sm text-muted hover:text-content"
          >
            <Avatar user={r.author} size={24} />
            Review by <span className="font-semibold text-content">{name}</span>
          </Link>
          <h1 className="mt-3 font-cond text-3xl font-extrabold uppercase leading-[0.95] tracking-tight sm:text-4xl">
            <Link to={mediaHref(r.media)} className="hover:text-gold">
              {r.media.title}
            </Link>
            {r.media.year && (
              <span className="ml-2.5 text-xl font-bold tabular-nums text-muted sm:text-2xl">
                {r.media.year}
              </span>
            )}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {r.ratingValue !== null && (
              <RatingMark
                value={r.ratingValue}
                type={r.media.type}
                size={16}
                display={isEpisodic(r.media.type) ? 'number' : 'stars'}
              />
            )}
            <span className="font-data text-[11px] text-muted-2">
              {r.watchedDate ? 'Watched ' : 'Written '}
              <DateText iso={r.watchedDate ?? r.createdAt} dateOnly={!!r.watchedDate} />
              {r.editedAt && ' · edited'}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-7">
        {hidden ? (
          <div className="rounded-sm border border-dashed border-border-hi px-5 py-6 text-center">
            <p className="font-cond text-[13px] font-extrabold uppercase tracking-[0.14em] text-content">
              This review contains spoilers
            </p>
            <Button className="mt-3" onClick={() => setRevealed(true)}>
              I can handle the truth
            </Button>
          </div>
        ) : (
          <p className="max-w-[68ch] whitespace-pre-wrap text-[15px] leading-relaxed text-content/90">
            {r.body}
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center gap-1">
        <ReviewLikeButton review={r} className="-ml-3" />
        {r.isOwnReview && (
          <>
            <Link
              to={mediaHref(r.media)}
              className="ml-2 font-cond text-[11px] font-bold uppercase tracking-[0.12em] text-muted-2 hover:text-content hover:underline"
            >
              Edit on the title's page
            </Link>
            <Button
              variant="link"
              size="sm"
              className="ml-3"
              onClick={async () => {
                const ok = await confirm({
                  title: 'Delete this review?',
                  confirmLabel: 'Delete review',
                  danger: true,
                });
                if (ok) remove.mutate();
              }}
            >
              Delete
            </Button>
          </>
        )}
      </div>

      <section className="mt-10">
        <SectionHeader title="Comments" count={r.commentCount} />
        {/* Comments can discuss the ending too; they wait for the reveal. */}
        {hidden ? (
          <p className="text-sm text-muted-2">Reveal the review to read its comments.</p>
        ) : (
          <div className="[&>div]:mt-0 [&>div]:border-t-0 [&>div]:pt-0">
            <ReviewComments reviewId={r.id} />
          </div>
        )}
      </section>
    </div>
  );
}
