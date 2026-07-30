import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import type { ProfileDiaryEntry, PublicProfile } from '@cinelog/contracts';
import { fromNormalized, scaleForMediaType } from '@cinelog/contracts';
import { useAuth } from '../lib/auth';
import { api, ApiError } from '../lib/api';
import { posterGradient } from '../lib/poster';
import { cn } from '../lib/cn';
import { Avatar } from '../components/Avatar';
import { PosterCard } from '../components/PosterCard';
import { Button, Card, Spinner } from '../components/ui';
import { FavoritesEditorModal } from '../components/FavoritesEditorModal';
import { FollowButton, MemberCard } from '../components/MemberCard';
import { ListCard } from '../components/ListCard';
import { CreateListModal } from './ListsPage';
import { EmptyState } from '../components/lb';

type Tab = 'overview' | 'diary' | 'reviews' | 'watched' | 'lists' | 'watchlist' | 'network';

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
        <TabButton active={tab === 'reviews'} onClick={() => setTab('reviews')}>
          Reviews
        </TabButton>
        <TabButton active={tab === 'watched'} onClick={() => setTab('watched')}>
          Watched
        </TabButton>
        <TabButton active={tab === 'lists'} onClick={() => setTab('lists')}>
          Lists
        </TabButton>
        {profile.canViewWatchlist && (
          <TabButton active={tab === 'watchlist'} onClick={() => setTab('watchlist')}>
            Watchlist
          </TabButton>
        )}
        <TabButton active={tab === 'network'} onClick={() => setTab('network')}>
          Network
        </TabButton>
      </div>

      {tab === 'overview' && (
        <div className="mt-8 grid gap-8 lg:grid-cols-[2fr_1fr]">
          <section>
            <SectionTitle>Favorite films</SectionTitle>
            {profile.favoriteFilms.length === 0 ? (
              <EmptyFavorites
                isOwnProfile={profile.isOwnProfile}
                label="films"
                onEdit={() => setEditingFavorites(true)}
              />
            ) : (
              <div className="grid grid-cols-4 gap-4">
                {profile.favoriteFilms.map((f) => (
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

            <div className="mt-8">
              <SectionTitle>Favorite shows</SectionTitle>
              {profile.favoriteShows.length === 0 ? (
                <EmptyFavorites
                  isOwnProfile={profile.isOwnProfile}
                  label="shows"
                  onEdit={() => setEditingFavorites(true)}
                />
              ) : (
                <div className="grid grid-cols-4 gap-4">
                  {profile.favoriteShows.map((f) => (
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
            </div>

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
                      className="rounded-sm border border-border-hi bg-surface-2 px-2.5 py-1 font-cond text-[11px] font-bold uppercase tracking-[0.08em] text-muted"
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
      {tab === 'reviews' && <ReviewsTab username={profile.username} />}
      {tab === 'watched' && <WatchedTab username={profile.username} />}
      {tab === 'lists' && (
        <ListsTab username={profile.username} isOwnProfile={profile.isOwnProfile} />
      )}
      {tab === 'watchlist' && profile.canViewWatchlist && <WatchlistTab username={profile.username} />}
      {tab === 'network' && <NetworkTab username={profile.username} />}

      {editingFavorites && (
        <FavoritesEditorModal
          username={profile.username}
          initialFilms={profile.favoriteFilms}
          initialShows={profile.favoriteShows}
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
        <span className="font-data text-xs font-bold text-gold">
          {fromNormalized(entry.rating, scaleForMediaType(entry.media.type))}
        </span>
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

function ListsTab({
  username,
  isOwnProfile,
}: {
  username: string;
  isOwnProfile: boolean;
}): JSX.Element {
  const [creating, setCreating] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['user-lists', username],
    queryFn: () => api.getUserLists(username),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mt-6">
      {(data?.lists.length ?? 0) === 0 ? (
        <EmptyState
          title={isOwnProfile ? "You haven't made a list yet" : 'No lists yet'}
          body={
            isOwnProfile
              ? 'Group films into a top ten, a marathon, or any collection you like.'
              : undefined
          }
          action={
            isOwnProfile ? (
              <Button variant="primary" onClick={() => setCreating(true)}>
                + New list
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {isOwnProfile && (
            <div className="mb-4 flex justify-end">
              <Button variant="secondary" onClick={() => setCreating(true)}>
                + New list
              </Button>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data?.lists.map((l) => (
              <ListCard key={l.id} list={l} />
            ))}
          </div>
        </>
      )}
      {creating && <CreateListModal onClose={() => setCreating(false)} />}
    </div>
  );
}

function NetworkTab({ username }: { username: string }): JSX.Element {
  const [side, setSide] = useState<'followers' | 'following'>('followers');
  const { data, isLoading } = useQuery({
    queryKey: ['network', username, side],
    queryFn: () =>
      side === 'followers' ? api.getFollowers(username) : api.getFollowing(username),
  });

  return (
    <div className="mt-6">
      <div className="mb-4 flex gap-1 rounded border border-border bg-surface p-0.5 sm:w-fit">
        {(['followers', 'following'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSide(s)}
            className={cn(
              'flex-1 rounded px-4 py-1.5 font-cond text-[13px] font-bold uppercase tracking-wide transition-colors sm:flex-none',
              side === s ? 'bg-gold text-ink' : 'text-muted hover:text-content',
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (data?.members.length ?? 0) === 0 ? (
        <EmptyState
          title={side === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
        />
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {data?.members.map((m) => (
            <MemberCard key={m.id} member={m} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewsTab({ username }: { username: string }): JSX.Element {
  const navigate = useNavigate();
  const [revealedBodies, setRevealedBodies] = useState<Record<string, string>>({});
  const { data, isLoading } = useQuery({
    queryKey: ['profile-reviews', username],
    queryFn: () => api.getProfileReviews(username),
  });

  async function reveal(reviewId: string): Promise<void> {
    const full = await api.getReview(reviewId);
    setRevealedBodies((prev) => ({ ...prev, [reviewId]: full.body }));
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }
  if ((data?.reviews.length ?? 0) === 0) {
    return <p className="py-10 text-center text-muted">No reviews yet.</p>;
  }

  return (
    <div className="mt-6 divide-y divide-border">
      {data?.reviews.map((r) => (
        <div key={r.id} className="flex items-start gap-3 py-4">
          <button
            onClick={() => navigate(`/media/${r.media.id}`)}
            className="h-20 w-14 shrink-0 overflow-hidden rounded bg-surface-2"
          >
            {r.media.posterUrl ? (
              <img src={r.media.posterUrl} alt={r.media.title} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full" style={{ background: posterGradient(r.media.title) }} />
            )}
          </button>
          <div className="min-w-0 flex-1">
            <button onClick={() => navigate(`/media/${r.media.id}`)} className="text-left">
              <span className="text-sm font-medium text-content hover:text-gold">
                {r.media.title} {r.media.year && <span className="text-muted-2">({r.media.year})</span>}
              </span>
            </button>
            {r.ratingValue !== null && (
              <span className="ml-2 text-xs font-semibold text-gold">
                {fromNormalized(r.ratingValue, scaleForMediaType(r.media.type))}
              </span>
            )}
            <p className="text-xs text-muted-2">{new Date(r.createdAt).toLocaleDateString()}</p>
            {r.concealed && revealedBodies[r.id] === undefined ? (
              <button
                onClick={() => void reveal(r.id)}
                className="mt-1.5 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-muted hover:text-content"
              >
                Contains spoilers — click to reveal
              </button>
            ) : (
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-content/90">
                {revealedBodies[r.id] ?? r.body}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Every title the member has watched, rated, or marked completed — not just
 *  the ones with a diary entry. Uses PosterCard (rating badge top-right) to
 *  match the same convention as Library/Watchlist, rather than the inline
 *  star-text style used elsewhere on the page. */
function WatchedTab({ username }: { username: string }): JSX.Element {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['profile-watched', username],
    queryFn: () => api.getProfileWatched(username),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }
  if ((data?.entries.length ?? 0) === 0) {
    return <p className="py-10 text-center text-muted">Nothing watched yet.</p>;
  }

  return (
    <div className="mt-6 grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {data?.entries.map((e, i) => (
        <PosterCard
          key={e.media.id}
          title={e.media.title}
          year={e.media.year}
          type={e.media.type}
          posterUrl={e.media.posterUrl}
          rating={e.rating}
          index={i}
          onClick={() => navigate(`/media/${e.media.id}`)}
        />
      ))}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <h2 className="mb-3 font-cond text-[13px] font-extrabold uppercase tracking-[0.16em] text-content">
      {children}
    </h2>
  );
}

function EmptyFavorites({
  isOwnProfile,
  onEdit,
  label,
}: {
  isOwnProfile: boolean;
  onEdit: () => void;
  label: string;
}): JSX.Element {
  return (
    <Card className="p-6 text-center">
      <p className="text-sm text-muted">
        {isOwnProfile ? `Pick up to 4 ${label} to feature on your profile.` : `No favorite ${label} yet.`}
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
            className={cn('w-full', b.count > 0 ? 'bg-gold' : 'bg-border')}
            style={{ height: `${Math.max(4, (b.count / max) * 100)}%` }}
            title={`${b.count} rating${b.count === 1 ? '' : 's'}`}
          />
          <span className="font-data text-[11px] text-muted-2">{b.bucket}</span>
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
      {/* Header backdrop: a collage of the member's own favorite posters, the
          way a Letterboxd profile header is built from the account's own
          activity rather than a separately-uploaded banner image. */}
      <div className="relative">
        <div className="h-40 overflow-hidden rounded-2xl border border-border bg-surface-2 sm:h-52">
          {(() => {
            const banner = [...profile.favoriteFilms, ...profile.favoriteShows].slice(0, 4);
            return banner.length > 0 ? (
              <div className="grid h-full grid-cols-4">
                {banner.map((f) => (
                  <div key={f.media.id} className="relative overflow-hidden">
                    {f.media.posterUrl ? (
                      <img src={f.media.posterUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full" style={{ background: posterGradient(f.media.title) }} />
                    )}
                  </div>
                ))}
                {Array.from({ length: 4 - banner.length }).map((_, i) => (
                  <div key={`fill-${i}`} style={{ background: posterGradient(profile.username + i) }} />
                ))}
              </div>
            ) : null;
          })()}
          {[...profile.favoriteFilms, ...profile.favoriteShows].length === 0 && (
            <div className="h-full w-full" style={{ background: posterGradient(profile.username) }} />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-black/20" />
        </div>
        <div className="absolute -bottom-8 left-5">
          <div className="rounded-sm ring-4 ring-bg">
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
        ) : (
          profile.isFollowedByViewer !== null && (
            <div className="flex items-center gap-2">
              {profile.followsViewer && (
                <span className="font-cond text-[11px] font-bold uppercase tracking-wide text-cyan">
                  Follows you
                </span>
              )}
              <FollowButton
                username={profile.username}
                initialFollowing={profile.isFollowedByViewer}
              />
            </div>
          )
        )}
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
    { label: 'Followers', value: profile.followerCount },
    { label: 'Following', value: profile.followingCount },
  ];
  return (
    <div className="mt-6 grid grid-cols-3 gap-3 border-t border-border pt-6 sm:grid-cols-6">
      {items.map((i) => (
        <div key={i.label} className="text-center">
          <p className="font-data text-2xl font-bold text-content">{i.value}</p>
          <p className="font-cond text-[11px] font-bold uppercase tracking-[0.16em] text-muted-2">
            {i.label}
          </p>
        </div>
      ))}
    </div>
  );
}
