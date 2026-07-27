import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import type { ProfileDiaryEntry, PublicProfile } from '@cinelog/contracts';
import { fromNormalized } from '@cinelog/contracts';
import { useAuth } from '../lib/auth';
import { api, ApiError } from '../lib/api';
import { posterGradient } from '../lib/poster';
import { cn } from '../lib/cn';
import { Avatar } from '../components/Avatar';
import { PosterCard } from '../components/PosterCard';
import { Button, Card, Spinner } from '../components/ui';
import { FavoritesEditorModal } from '../components/FavoritesEditorModal';

type Tab = 'overview' | 'diary' | 'watchlist';

export function PublicProfilePage(): JSX.Element {
  const params = useParams<{ username?: string }>();
  const { user: viewer } = useAuth();
  const username = params.username ?? viewer?.username;
  const navigate = useNavigate();
  const [editingFavorites, setEditingFavorites] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');

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

      <div className="mt-8 flex gap-1 border-b border-border">
        <TabButton active={tab === 'overview'} onClick={() => setTab('overview')}>
          Overview
        </TabButton>
        <TabButton active={tab === 'diary'} onClick={() => setTab('diary')}>
          Diary
        </TabButton>
        {profile.canViewWatchlist && (
          <TabButton active={tab === 'watchlist'} onClick={() => setTab('watchlist')}>
            Watchlist
          </TabButton>
        )}
      </div>

      {tab === 'overview' && (
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
      )}

      {tab === 'diary' && <DiaryTab username={profile.username} isOwnProfile={profile.isOwnProfile} />}
      {tab === 'watchlist' && profile.canViewWatchlist && <WatchlistTab username={profile.username} />}

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

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      className={cn(
        'border-b-2 px-3 py-2.5 font-cond text-[13px] font-bold uppercase tracking-wide transition-colors',
        active ? 'border-gold text-content' : 'border-transparent text-muted hover:text-content',
      )}
    >
      {children}
    </button>
  );
}

function DiaryTab({ username, isOwnProfile }: { username: string; isOwnProfile: boolean }): JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['profile-diary', username],
    queryFn: () => api.getProfileDiary(username),
  });

  const deleteMut = useMutation({
    mutationFn: (entryId: string) => api.deleteWatchEntry(entryId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['profile-diary', username] }),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }
  if ((data?.entries.length ?? 0) === 0) {
    return <p className="py-10 text-center text-muted">No diary entries yet.</p>;
  }

  return (
    <div className="mt-6 divide-y divide-border">
      {data?.entries.map((entry) => (
        <DiaryRow
          key={entry.id}
          entry={entry}
          canEdit={isOwnProfile}
          onOpen={() => navigate(`/media/${entry.media.id}`)}
          onDelete={() => deleteMut.mutate(entry.id)}
        />
      ))}
    </div>
  );
}

function DiaryRow({
  entry,
  canEdit,
  onOpen,
  onDelete,
}: {
  entry: ProfileDiaryEntry;
  canEdit: boolean;
  onOpen: () => void;
  onDelete: () => void;
}): JSX.Element {
  return (
    <div className="flex items-center gap-3 py-3">
      <button onClick={onOpen} className="h-16 w-11 shrink-0 overflow-hidden rounded bg-surface-2">
        {entry.media.posterUrl ? (
          <img src={entry.media.posterUrl} alt={entry.media.title} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full" style={{ background: posterGradient(entry.media.title) }} />
        )}
      </button>
      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-medium text-content">
          {entry.media.title} {entry.media.year && <span className="text-muted-2">({entry.media.year})</span>}
        </p>
        <p className="text-xs text-muted-2">
          {new Date(entry.watchedAt).toLocaleDateString()}
          {entry.isRewatch && ' · rewatch'}
        </p>
      </button>
      {entry.rating !== null && (
        <span className="text-xs font-semibold text-gold">{fromNormalized(entry.rating, 'TEN')}</span>
      )}
      {canEdit && (
        <button
          onClick={() => {
            if (confirm('Remove this diary entry?')) onDelete();
          }}
          className="text-xs text-muted-2 hover:text-rose"
        >
          Remove
        </button>
      )}
    </div>
  );
}

function WatchlistTab({ username }: { username: string }): JSX.Element {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['profile-watchlist', username],
    queryFn: () => api.getProfileWatchlist(username),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }
  if ((data?.items.length ?? 0) === 0) {
    return <p className="py-10 text-center text-muted">Nothing on the watchlist yet.</p>;
  }

  return (
    <div className="mt-6 grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {data?.items.map((item, i) => (
        <PosterCard
          key={item.id}
          title={item.title}
          year={item.year}
          type={item.type}
          posterUrl={item.posterUrl}
          index={i}
          onClick={() => navigate(`/media/${item.id}`)}
        />
      ))}
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
