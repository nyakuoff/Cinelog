import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { MemberSummary } from '@cinelog/contracts';
import { api } from '../lib/api';
import { plural } from '../lib/format';
import { Avatar } from './Avatar';
import { Button } from './ui';

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
  const queryClient = useQueryClient();

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
      // Follower counts, followers-only tabs, the following feed, and friend
      // ratings all depend on the follow graph.
      for (const queryKey of [['profile'], ['members'], ['activity'], ['friend-ratings']]) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });

  // Following is your mark on someone, so the offer is the amber field; once
  // made it settles back to a ruled label.
  return (
    <Button
      variant={following ? 'secondary' : 'primary'}
      size={size}
      onClick={() => mut.mutate(!following)}
      disabled={mut.isPending}
      aria-pressed={following}
    >
      {following ? 'Following' : 'Follow'}
    </Button>
  );
}

export function MemberCard({ member }: { member: MemberSummary }): JSX.Element {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-sm border border-border bg-surface p-3">
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
        <p className="truncate font-data text-[11px] text-muted-2">
          {member.filmCount} rated · {plural(member.followerCount, 'follower')}
          {member.followsViewer && <span className="ml-1.5 text-cyan">· follows you</span>}
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
