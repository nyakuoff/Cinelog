import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { MemberSummary } from '@cinelog/contracts';
import { api } from '../lib/api';
import { cn } from '../lib/cn';
import { Avatar } from './Avatar';

/** A follow/unfollow control with optimistic state and rollback on failure. */
export function FollowButton({
  username,
  initialFollowing,
  onChange,
  size = 'md',
}: {
  username: string;
  initialFollowing: boolean;
  onChange?: (following: boolean) => void;
  size?: 'sm' | 'md';
}): JSX.Element {
  const [following, setFollowing] = useState(initialFollowing);

  const mut = useMutation({
    mutationFn: (next: boolean) => (next ? api.follow(username) : api.unfollow(username)),
    onMutate: (next: boolean) => {
      const prev = following;
      setFollowing(next);
      onChange?.(next);
      return prev;
    },
    onError: (_err, _next, prev) => {
      if (prev !== undefined) {
        setFollowing(prev);
        onChange?.(prev);
      }
    },
    onSuccess: (res) => {
      setFollowing(res.following);
      onChange?.(res.following);
    },
  });

  return (
    <button
      onClick={() => mut.mutate(!following)}
      disabled={mut.isPending}
      aria-pressed={following}
      className={cn(
        'shrink-0 rounded border font-cond font-bold uppercase tracking-[0.08em] transition-colors disabled:opacity-60',
        size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3.5 py-1.5 text-[12px]',
        following
          ? 'border-border-hi bg-surface-2 text-muted hover:border-rose hover:text-rose'
          : 'border-gold bg-gold text-ink hover:brightness-110',
      )}
    >
      {following ? 'Following' : 'Follow'}
    </button>
  );
}

export function MemberCard({ member }: { member: MemberSummary }): JSX.Element {
  return (
    <div className="flex items-center gap-3 rounded border border-border bg-surface/60 p-3">
      <Link to={`/u/${member.username}`} className="shrink-0">
        <Avatar user={{ username: member.username, avatarUrl: member.avatarUrl }} size={44} />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          to={`/u/${member.username}`}
          className="block truncate text-sm font-semibold text-content hover:text-gold"
        >
          {member.displayName || member.username}
        </Link>
        <p className="truncate text-xs text-muted-2">
          {member.filmCount} rated · {member.followerCount} follower
          {member.followerCount === 1 ? '' : 's'}
          {member.followsViewer && <span className="ml-1.5 text-cyan">· Follows you</span>}
        </p>
      </div>
      {!member.isSelf && member.isFollowedByViewer !== null && (
        <FollowButton
          username={member.username}
          initialFollowing={member.isFollowedByViewer}
          size="sm"
        />
      )}
    </div>
  );
}
