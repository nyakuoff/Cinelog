import { useInfiniteQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { ActivityItem } from '@cinelog/contracts';
import { api } from '../lib/api';
import { relativeTime } from '../lib/format';
import { Avatar } from './Avatar';
import { EmptyState, ErrorState, mediaHref, PosterThumb } from './lb';
import { RatingMark } from './Rating';
import { LoadMore, Spinner } from './ui';

/** Verb phrasing per event kind — the sentence a feed row reads as. */
const VERB: Record<ActivityItem['type'], string> = {
  RATED: 'rated',
  REVIEWED: 'reviewed',
  WATCHED: 'watched',
  FAVORITED: 'liked',
  LIST_CREATED: 'created a list',
  LIST_UPDATED: 'updated a list',
  REVIEW_LIKED: 'liked a review',
  FOLLOWED: 'followed',
};

export function ActivityFeed({
  scope,
  username,
  emptyTitle,
  emptyBody,
  limit,
  types,
}: {
  /** The feed's reach — or pass `username` for one member's own feed. */
  scope?: 'FOLLOWING' | 'EVERYONE';
  username?: string;
  emptyTitle: string;
  emptyBody: string;
  /** Cap the rows rendered; a sidebar rail wants a short list, not a page. */
  limit?: number;
  /** Restrict to these event kinds. */
  types?: ActivityItem['type'][];
}): JSX.Element {
  const query = useInfiniteQuery({
    // A member's feed sits under the profile prefix so profile invalidation covers it.
    queryKey: username
      ? ['profile', username, 'activity']
      : ['activity', scope, limit, types?.join(',')],
    queryFn: ({ pageParam }) =>
      username
        ? api.getProfileActivity(username, { limit, cursor: pageParam })
        : api.getActivity(scope ?? 'FOLLOWING', { limit, types, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    // A capped rail is a preview, not a feed — it never pages.
    getNextPageParam: (last) => (limit ? undefined : (last.nextCursor ?? undefined)),
  });
  const { data, isLoading, isError, refetch } = query;
  const items = data?.pages.flatMap((p) => p.items) ?? [];

  // A capped rail is a preview in a sidebar, so its states stay small.
  if (isLoading) return <Spinner center />;
  if (isError) {
    return (
      <ErrorState compact={!!limit} title="Couldn't load activity" onRetry={() => void refetch()} />
    );
  }
  if (items.length === 0) {
    return <EmptyState compact={!!limit} title={emptyTitle} body={emptyBody} />;
  }

  const rows = limit ? items.slice(0, limit) : items;
  return (
    <>
      <ul className="divide-y divide-border">
        {rows.map((item) => (
          <ActivityRow key={item.id} item={item} />
        ))}
      </ul>
      <LoadMore query={query} />
    </>
  );
}

function ActivityRow({ item }: { item: ActivityItem }): JSX.Element {
  const name = item.actor.displayName || item.actor.username;
  const allMedia = item.media ? [item.media, ...item.groupedMedia] : [];

  return (
    <li className="flex items-start gap-3 py-3">
      <Link to={`/u/${item.actor.username}`} className="shrink-0">
        <Avatar
          user={{ username: item.actor.username, avatarUrl: item.actor.avatarUrl }}
          size={32}
        />
      </Link>

      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted">
          <Link
            to={`/u/${item.actor.username}`}
            className="font-semibold text-content hover:text-gold"
          >
            {name}
          </Link>{' '}
          {item.type === 'REVIEWED' && item.reviewId ? (
            <Link to={`/review/${item.reviewId}`} className="underline-offset-2 hover:underline">
              reviewed
            </Link>
          ) : (
            VERB[item.type]
          )}
          {item.targetUser && (
            <>
              {' '}
              <Link
                to={`/u/${item.targetUser.username}`}
                className="font-semibold text-content hover:text-gold"
              >
                {item.targetUser.displayName || item.targetUser.username}
              </Link>
            </>
          )}
          {item.listId && item.listTitle && (
            <>
              {' '}
              <Link
                to={`/lists/${item.listId}`}
                className="font-semibold text-content hover:text-gold"
              >
                {item.listTitle}
              </Link>
            </>
          )}
          {item.media && (
            <>
              {' '}
              <Link
                to={`/media/${item.media.id}`}
                className="font-semibold text-content hover:text-gold"
              >
                {item.media.title}
              </Link>
              {item.groupedMedia.length > 0 && (
                <span className="text-muted-2"> and {item.groupedMedia.length} more</span>
              )}
            </>
          )}
          {item.ratingValue !== null && (item.type === 'RATED' || item.type === 'REVIEWED') && (
            <>
              {' '}
              <RatingMark
                value={item.ratingValue}
                type={item.media?.type}
                size={12}
                className="align-middle"
              />
            </>
          )}
        </p>
        <p className="mt-0.5 font-data text-[11px] text-muted-2">{relativeTime(item.createdAt)}</p>

        {allMedia.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {allMedia.slice(0, 8).map((m) => (
              <PosterThumb
                key={m.id}
                title={m.title}
                posterUrl={m.posterUrl}
                to={mediaHref(m)}
                size="sm"
              />
            ))}
          </div>
        )}
      </div>
    </li>
  );
}
