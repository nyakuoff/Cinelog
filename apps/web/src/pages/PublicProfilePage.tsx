import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import type { PublicProfile } from '@cinelog/contracts';
import { useAuth } from '../lib/auth';
import { api, ApiError } from '../lib/api';
import { posterGradient } from '../lib/poster';
import { Avatar } from '../components/Avatar';
import { PosterCard } from '../components/PosterCard';
import { Button, Card, Spinner } from '../components/ui';
import { FavoritesEditorModal } from '../components/FavoritesEditorModal';

export function PublicProfilePage(): JSX.Element {
  const params = useParams<{ username?: string }>();
  const { user: viewer } = useAuth();
  const username = params.username ?? viewer?.username;
  const navigate = useNavigate();
  const [editingFavorites, setEditingFavorites] = useState(false);

  const { data: profile, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['profile', username],
    queryFn: () => api.getPublicProfile(username as string),
    enabled: !!username,
  });

  if (!username) return <></>;

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }

  if (isError) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <p className="mb-4 text-muted">
          {notFound ? 'No user found with that username.' : 'Could not load this profile.'}
        </p>
        {!notFound && (
          <Button variant="secondary" onClick={() => void refetch()}>
            Try again
          </Button>
        )}
      </div>
    );
  }

  if (!profile) return <></>;

  if (!profile.canView) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <Avatar
          user={{ username: profile.username, avatarUrl: profile.avatarUrl }}
          size={64}
          className="mx-auto mb-4"
        />
        <h1 className="font-cond text-xl font-extrabold uppercase tracking-tight">
          @{profile.username}
        </h1>
        <p className="mt-2 text-sm text-muted">This profile is private.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <ProfileHeader
        profile={profile}
        onEditFavorites={() => setEditingFavorites(true)}
        onEditProfile={() => navigate('/settings')}
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-[2fr_1fr]">
        <section>
          <SectionTitle>Favorites</SectionTitle>
          {profile.favorites.length === 0 ? (
            <EmptyFavorites isOwnProfile={profile.isOwnProfile} onEdit={() => setEditingFavorites(true)} />
          ) : (
            <div className="grid grid-cols-4 gap-4">
              {profile.favorites.map((f) => (
                <PosterCard
                  key={f.media.id}
                  title={f.media.title}
                  year={f.media.year}
                  type={f.media.type}
                  posterUrl={f.media.posterUrl}
                  onClick={() => navigate(`/media/${f.media.id}`)}
                />
              ))}
            </div>
          )}

          <div className="mt-10">
            <SectionTitle>Rating distribution</SectionTitle>
            <RatingHistogram buckets={profile.ratingDistribution} />
          </div>
        </section>

        <aside className="space-y-8">
          <div>
            <SectionTitle>Genres</SectionTitle>
            {profile.topGenres.length === 0 ? (
              <p className="text-sm text-muted-2">No rated titles yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {profile.topGenres.map((g) => (
                  <span
                    key={g.genre}
                    className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs text-muted"
                  >
                    {g.genre} <span className="text-muted-2">· {g.count}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {editingFavorites && (
        <FavoritesEditorModal
          username={profile.username}
          initial={profile.favorites}
          onClose={() => setEditingFavorites(false)}
        />
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <h2 className="mb-3 font-cond text-[13px] font-extrabold uppercase tracking-[0.12em] text-muted">
      {children}
    </h2>
  );
}

function EmptyFavorites({
  isOwnProfile,
  onEdit,
}: {
  isOwnProfile: boolean;
  onEdit: () => void;
}): JSX.Element {
  return (
    <Card className="p-6 text-center">
      <p className="text-sm text-muted">
        {isOwnProfile ? 'Pick up to 4 titles to feature on your profile.' : 'No favorites yet.'}
      </p>
      {isOwnProfile && (
        <Button variant="secondary" className="mt-3" onClick={onEdit}>
          Choose favorites
        </Button>
      )}
    </Card>
  );
}

function RatingHistogram({ buckets }: { buckets: { bucket: number; count: number }[] }): JSX.Element {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const total = buckets.reduce((s, b) => s + b.count, 0);
  if (total === 0) return <p className="text-sm text-muted-2">No ratings yet.</p>;
  return (
    <div className="flex h-28 items-end gap-1.5">
      {buckets.map((b) => (
        <div key={b.bucket} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t bg-gradient-to-t from-gold/40 to-gold"
            style={{ height: `${Math.max(4, (b.count / max) * 100)}%` }}
            title={`${b.count} rating${b.count === 1 ? '' : 's'}`}
          />
          <span className="text-[10px] text-muted-2">{b.bucket}</span>
        </div>
      ))}
    </div>
  );
}

function ProfileHeader({
  profile,
  onEditFavorites,
  onEditProfile,
}: {
  profile: PublicProfile;
  onEditFavorites: () => void;
  onEditProfile: () => void;
}): JSX.Element {
  const joined = new Date(profile.joinedAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
  });
  return (
    <div>
      <div className="relative">
        <div
          className="h-40 overflow-hidden rounded-2xl border border-border bg-surface-2 sm:h-52"
          style={!profile.bannerUrl ? { background: posterGradient(profile.username) } : undefined}
        >
          {profile.bannerUrl && (
            <img src={profile.bannerUrl} alt="" className="h-full w-full object-cover" />
          )}
          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        </div>
        <div className="absolute -bottom-8 left-5">
          <div className="rounded-full ring-4 ring-bg">
            <Avatar user={{ username: profile.username, avatarUrl: profile.avatarUrl }} size={80} />
          </div>
        </div>
      </div>

      <div className="mt-10 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-cond text-2xl font-extrabold uppercase tracking-tight">
            {profile.displayName || profile.username}
          </h1>
          <p className="text-sm text-muted-2">
            @{profile.username} · Joined {joined}
          </p>
          {profile.bio && <p className="mt-2 max-w-xl text-sm text-muted">{profile.bio}</p>}
          <div className="mt-3 flex gap-4 text-sm">
            <span>
              <strong className="text-content">{profile.followerCount}</strong>{' '}
              <span className="text-muted-2">followers</span>
            </span>
            <span>
              <strong className="text-content">{profile.followingCount}</strong>{' '}
              <span className="text-muted-2">following</span>
            </span>
          </div>
        </div>

        {profile.isOwnProfile ? (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onEditFavorites}>
              Edit favorites
            </Button>
            <Button variant="secondary" onClick={onEditProfile}>
              Edit profile
            </Button>
          </div>
        ) : null}
      </div>

      <StatsRow profile={profile} />
    </div>
  );
}

function StatsRow({ profile }: { profile: PublicProfile }): JSX.Element {
  const stats = profile.stats;
  const items = [
    { label: 'Films', value: stats.moviesWatched },
    { label: 'Shows', value: stats.showsWatched },
    { label: 'Episodes', value: stats.episodesWatched },
    { label: 'Ratings', value: stats.totalRatings },
  ];
  return (
    <div className="mt-6 grid grid-cols-4 gap-3 border-t border-border pt-6">
      {items.map((i) => (
        <div key={i.label} className="text-center">
          <p className="font-cond text-2xl font-extrabold tabular-nums text-content">{i.value}</p>
          <p className="font-cond text-[11px] font-bold uppercase tracking-wide text-muted-2">
            {i.label}
          </p>
        </div>
      ))}
    </div>
  );
}
