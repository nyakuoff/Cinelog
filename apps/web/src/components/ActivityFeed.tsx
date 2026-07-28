import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { ActivityItem, MediaSummary } from '@cinelog/contracts';
import { api } from '../lib/api';
import { posterGradient } from '../lib/poster';
import { Avatar } from './Avatar';
import { EmptyState, StarText } from './lb';
import { Spinner } from './ui';

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
  emptyTitle,
  emptyBody,
}: {
  scope: 'FOLLOWING' | 'EVERYONE';
  emptyTitle: string;
  emptyBody: string;
}): JSX.Element {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['activity', scope],
    queryFn: () => api.getActivity(scope),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }
  if (isError) {
    return (
      <EmptyState
        title="Couldn't load activity"
        body="Something went wrong fetching the feed."
        action={
          <button
            onClick={() => void refetch()}
            className="rounded border border-border px-3 py-1.5 text-sm text-muted hover:text-content"
          >
            Try again
          </button>
        }
      />
    );
  }
  if (!data || data.items.length === 0) {
    return <EmptyState title={emptyTitle} body={emptyBody} />;
  }

  return (
    <ul className="divide-y divide-border">
      {data.items.map((item) => (
        <ActivityRow key={item.id} item={item} />
      ))}
    </ul>
  );
}

function ActivityRow({ item }: { item: ActivityItem }): JSX.Element {
  const name = item.actor.displayName || item.actor.username;
  const allMedia = item.media ? [item.media, ...item.groupedMedia] : [];

  return (
    <li className="flex items-start gap-3 py-3">
      <Link to={`/u/${item.actor.username}`} className="shrink-0">
        <Avatar user={{ username: item.actor.username, avatarUrl: item.actor.avatarUrl }} size={32} />
      </Link>

      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted">
          <Link to={`/u/${item.actor.username}`} className="font-semibold text-content hover:text-gold">
            {name}
          </Link>{' '}
          {VERB[item.type]}
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
          {item.media && (
            <>
              {' '}
              <Link to={`/media/${item.media.id}`} className="font-semibold text-content hover:text-gold">
                {item.media.title}
              </Link>
              {item.groupedMedia.length > 0 && (
                <span className="text-muted-2">
                  {' '}
                  and {item.groupedMedia.length} more
                </span>
              )}
            </>
          )}
          {item.ratingValue !== null && (item.type === 'RATED' || item.type === 'REVIEWED') && (
            <>
              {' '}
              <StarText value={item.ratingValue} size={12} className="align-middle" />
            </>
          )}
        </p>
        <p className="mt-0.5 font-data text-[11px] text-muted-2">{relativeTime(item.createdAt)}</p>

        {allMedia.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {allMedia.slice(0, 8).map((m) => (
              <MiniPoster key={m.id} media={m} />
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

function MiniPoster({ media }: { media: MediaSummary }): JSX.Element {
  return (
    <Link
      to={`/media/${media.id}`}
      title={media.title}
      className="block h-[66px] w-11 shrink-0 overflow-hidden rounded-sm ring-1 ring-border-hi/60 hover:ring-2 hover:ring-gold"
    >
      {media.posterUrl ? (
        <img src={media.posterUrl} alt={media.title} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <span className="block h-full w-full" style={{ background: posterGradient(media.title) }} />
      )}
    </Link>
  );
}

/** Compact relative timestamp — feeds read better than absolute dates here. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
