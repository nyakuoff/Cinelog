import { useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  BROWSE_GENRES,
  type FavoriteSlot,
  type ProfileDiaryEntry,
  type ProfileLikesKind,
  type ProfileWatchedSort,
  type PublicProfile,
} from '@cinelog/contracts';
import { useAuth } from '../lib/auth';
import { api, ApiError } from '../lib/api';
import { useScreenHeader } from '../lib/appShell';
import { decadeOptions, formatMonth, localDateString } from '../lib/format';
import { invalidateUserMedia } from '../lib/invalidate';
import { posterGradient } from '../lib/poster';
import { cn } from '../lib/cn';
import { Avatar } from '../components/Avatar';
import { ActivityFeed } from '../components/ActivityFeed';
import {
  IconChevronRight,
  IconEdit,
  IconHeart,
  IconReview,
  IconRewatch,
} from '../components/app/Icons';
import {
  Button,
  Checkbox,
  Input,
  LoadMore,
  Notice,
  Segmented,
  Select,
  Spinner,
} from '../components/ui';
import { Dialog, useConfirm } from '../components/Dialog';
import { RatingHistogram, RatingMark } from '../components/Rating';
import { FavoritesEditorModal } from '../components/FavoritesEditorModal';
import { FollowButton, MemberCard } from '../components/MemberCard';
import { ListCard } from '../components/ListCard';
import { UserReviewCard } from '../components/ReviewsSection';
import { CreateListModal } from './ListsPage';
import {
  EmptyState,
  ErrorState,
  isEpisodic,
  mediaHref,
  Poster,
  PosterGrid,
  PosterGridSkeleton,
  PosterMarks,
  PosterThumb,
  SectionHeader,
  TabBar,
  Tag,
} from '../components/lb';

const TABS = [
  { key: 'profile', label: 'Profile' },
  { key: 'activity', label: 'Activity' },
  { key: 'films', label: 'Films' },
  { key: 'diary', label: 'Diary' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'watchlist', label: 'Watchlist' },
  { key: 'lists', label: 'Lists' },
  { key: 'likes', label: 'Likes' },
  { key: 'network', label: 'Network' },
] as const;
type Tab = (typeof TABS)[number]['key'];

/**
 * A member's profile. Each section is its own address — `/u/:username/:tab`,
 * or `/profile/:tab` for your own — so Back, reload and a shared link all land
 * on the section you were reading.
 */
export function PublicProfilePage(): JSX.Element {
  const params = useParams<{ username?: string; tab?: string }>();
  const { user: viewer } = useAuth();
  const username = params.username ?? viewer?.username;
  if (!username) return <></>;
  const tab = TABS.find((t) => t.key === params.tab)?.key ?? 'profile';
  // Keyed so /u/a → /u/b starts fresh (follow state) instead of reusing a's.
  return <ProfileView key={username} username={username} tab={tab} routed={!!params.username} />;
}

/** Query keys are all `['profile', username, ...]` so one prefix invalidates a profile. */
function ProfileView({
  username,
  tab,
  routed,
}: {
  username: string;
  tab: Tab;
  /** Reached as `/u/:username` (a pushed screen) rather than the `/profile` tab. */
  routed: boolean;
}): JSX.Element {
  const navigate = useNavigate();
  const [editingFavorites, setEditingFavorites] = useState(false);
  const base = routed ? `/u/${encodeURIComponent(username)}` : '/profile';

  const {
    data: profile,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['profile', username],
    queryFn: () => api.getPublicProfile(username),
  });

  // A section is titled with its own name (the back chevron returns to the
  // cover); a member's cover with their name; your own cover stays "Profile".
  useScreenHeader({
    title:
      tab !== 'profile'
        ? TABS.find((t) => t.key === tab)?.label
        : routed
          ? profile
            ? profile.displayName || profile.username
            : username
          : undefined,
  });

  if (isLoading) return <Spinner center />;

  if (isError) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        {notFound ? (
          <EmptyState title="Member not found" body="No one here has that username." />
        ) : (
          <ErrorState title="Could not load this profile" onRetry={() => void refetch()} />
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
        <h1 className="font-cond text-2xl font-extrabold uppercase tracking-[0.02em]">
          @{profile.username}
        </h1>
        {profile.profileVisibility === 'FOLLOWERS' && profile.isFollowedByViewer !== null ? (
          <>
            <p className="mt-2 text-sm text-muted">Follow to see their activity.</p>
            <div className="mt-4 flex justify-center">
              <FollowButton
                username={profile.username}
                initialFollowing={profile.isFollowedByViewer}
              />
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">This profile is private.</p>
        )}
      </div>
    );
  }

  const u = profile.username;
  const own = profile.isOwnProfile;
  const editFavorites = (): void => setEditingFavorites(true);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 app:py-4 sm:px-6">
      <ProfileHeader
        profile={profile}
        base={base}
        // The header is the profile's cover; the deeper sections keep only its
        // name line so their content starts near the top of a phone screen.
        compact={tab !== 'profile'}
        onEditFavorites={editFavorites}
        onEditProfile={() => navigate('/settings')}
      />

      {/* In the installed app, sections are rows on the cover (ProfileMenu). */}
      <TabBar
        className="mt-6 app:hidden"
        active={tab}
        tabs={TABS.filter((t) => t.key !== 'watchlist' || profile.canViewWatchlist).map((t) => ({
          ...t,
          to: t.key === 'profile' ? base : `${base}/${t.key}`,
        }))}
      />

      {tab === 'profile' && (
        <div className="mt-8 grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-8">
            <Favorites
              title="Favorite films"
              noun="films"
              slots={profile.favoriteFilms}
              profile={profile}
              onEdit={editFavorites}
            />
            <Favorites
              title="Favorite shows"
              noun="shows"
              slots={profile.favoriteShows}
              profile={profile}
              onEdit={editFavorites}
            />
            <RecentActivity username={u} base={base} />
            <ProfileMenu profile={profile} base={base} />
            <RecentReviews username={u} base={base} />
          </div>

          <aside className="min-w-0 space-y-8">
            <div>
              <SectionHeader
                title="Ratings"
                count={profile.stats.totalRatings}
                more={`${base}/films?rated=true&sort=RATING_DESC`}
                moreLabel="All"
              />
              {profile.stats.totalRatings === 0 ? (
                <p className="text-sm text-muted-2">No ratings yet.</p>
              ) : (
                <RatingHistogram
                  buckets={profile.ratingDistribution}
                  // Buckets are normalized; label them in whichever scale the
                  // member mostly rates in.
                  type={profile.stats.showsWatched > profile.stats.moviesWatched ? 'TV' : 'MOVIE'}
                  height={72}
                />
              )}
            </div>
            <div>
              <SectionHeader title="Genres" />
              {profile.topGenres.length === 0 ? (
                <p className="text-sm text-muted-2">No rated titles yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {profile.topGenres.map((g) => (
                    <Link
                      key={g.genre}
                      to={`${base}/films?genre=${encodeURIComponent(g.genre)}`}
                      className="hover:[&>*]:border-content hover:[&>*]:text-content"
                    >
                      <Tag count={g.count}>{g.genre}</Tag>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <div className="app:hidden">
              <SectionHeader title="Network" more={`${base}/network`} moreLabel="All" />
              <p className="flex gap-5 text-sm text-muted">
                <Link to={`${base}/network`} className="hover:text-content">
                  <b className="font-data text-content">{profile.followerCount}</b> followers
                </Link>
                <Link to={`${base}/network?side=following`} className="hover:text-content">
                  <b className="font-data text-content">{profile.followingCount}</b> following
                </Link>
              </p>
            </div>
          </aside>
        </div>
      )}

      {tab === 'activity' && (
        <div className="mt-2">
          <ActivityFeed
            username={u}
            emptyTitle="No activity yet"
            emptyBody={own ? 'What you log, rate and review shows up here.' : 'Nothing logged yet.'}
          />
        </div>
      )}
      {tab === 'films' && <FilmsTab username={u} own={own} />}
      {tab === 'diary' && <DiaryTab username={u} own={own} />}
      {tab === 'reviews' && <ReviewsTab username={u} />}
      {tab === 'watchlist' && profile.canViewWatchlist && <WatchlistTab username={u} />}
      {tab === 'lists' && <ListsTab username={u} isOwnProfile={own} />}
      {tab === 'likes' && <LikesTab username={u} />}
      {tab === 'network' && <NetworkTab username={u} />}

      {editingFavorites && (
        <FavoritesEditorModal
          username={u}
          initialFilms={profile.favoriteFilms}
          initialShows={profile.favoriteShows}
          onClose={() => setEditingFavorites(false)}
        />
      )}
    </div>
  );
}

/* ---- Overview ------------------------------------------------------------ */

/** The latest four diary entries as posters with the marks left on them. */
function RecentActivity({
  username,
  base,
}: {
  username: string;
  base: string;
}): JSX.Element | null {
  const { data } = useQuery({
    queryKey: ['profile', username, 'diary', 'recent'],
    queryFn: () => api.getProfileDiary(username, { limit: 4 }),
  });
  if (!data || data.entries.length === 0) return null;
  return (
    <div>
      <SectionHeader title="Recent activity" more={`${base}/diary`} moreLabel="Diary" />
      <PosterGrid variant="four">
        {data.entries.map((e) => (
          <Poster
            key={e.id}
            title={e.media.title}
            year={e.media.year}
            type={e.media.type}
            posterUrl={e.media.posterUrl}
            to={mediaHref(e.media, username)}
            caption={
              <PosterMarks
                type={e.media.type}
                rating={e.rating}
                liked={e.liked}
                rewatch={e.isRewatch}
                reviewId={e.reviewId}
              />
            }
          />
        ))}
      </PosterGrid>
    </div>
  );
}

function RecentReviews({ username, base }: { username: string; base: string }): JSX.Element | null {
  const { data } = useQuery({
    queryKey: ['profile', username, 'reviews', 'recent'],
    queryFn: () => api.getProfileReviews(username),
  });
  if (!data || data.reviews.length === 0) return null;
  return (
    <div>
      <SectionHeader title="Recent reviews" more={`${base}/reviews`} moreLabel="All reviews" />
      <div className="divide-y divide-border">
        {data.reviews.slice(0, 3).map((r) => (
          <UserReviewCard key={r.id} review={r} showAuthor={false} />
        ))}
      </div>
    </div>
  );
}

/** A member's four favourites, or the invitation to pick them. */
function Favorites({
  title,
  noun,
  slots,
  profile,
  onEdit,
}: {
  title: string;
  noun: string;
  slots: FavoriteSlot[];
  profile: PublicProfile;
  onEdit: () => void;
}): JSX.Element {
  return (
    <div>
      <SectionHeader title={title} />
      {slots.length === 0 ? (
        <EmptyState
          compact
          title={profile.isOwnProfile ? `Pick up to four ${noun}` : `No favorite ${noun} yet`}
          body={profile.isOwnProfile ? 'They sit at the top of your profile.' : undefined}
          action={
            profile.isOwnProfile ? <Button onClick={onEdit}>Choose favorites</Button> : undefined
          }
        />
      ) : (
        <PosterGrid variant="four">
          {slots.map((f) => (
            <Poster
              key={f.media.id}
              title={f.media.title}
              year={f.media.year}
              type={f.media.type}
              posterUrl={f.media.posterUrl}
              to={mediaHref(f.media, profile.username)}
            />
          ))}
        </PosterGrid>
      )}
    </div>
  );
}

function WatchlistTab({ username }: { username: string }): JSX.Element {
  const { data, isLoading } = useQuery({
    queryKey: ['profile', username, 'watchlist'],
    queryFn: () => api.getProfileWatchlist(username),
  });

  if (isLoading) return <Spinner center />;
  if ((data?.items.length ?? 0) === 0) {
    return <EmptyState compact className="mt-6" title="Nothing on the watchlist yet" />;
  }

  return (
    <PosterGrid className="mt-6">
      {data?.items.map((item) => (
        <Poster
          key={item.id}
          title={item.title}
          year={item.year}
          type={item.type}
          posterUrl={item.posterUrl}
          to={mediaHref(item, username)}
        />
      ))}
    </PosterGrid>
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

  if (isLoading) return <Spinner center />;

  return (
    <div className="mt-6">
      {(data?.lists.length ?? 0) === 0 ? (
        <EmptyState
          title={isOwnProfile ? "You haven't made a list yet" : 'No lists yet'}
          body={
            isOwnProfile
              ? 'Group titles into a top ten, a marathon, or any collection you like.'
              : undefined
          }
          action={
            isOwnProfile ? (
              <Button variant="primary" onClick={() => setCreating(true)}>
                New list
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {isOwnProfile && (
            <div className="mb-4 flex justify-end">
              <Button onClick={() => setCreating(true)}>New list</Button>
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

/* ---- Films ---------------------------------------------------------------- */

const WATCHED_SORTS: { value: ProfileWatchedSort; label: string }[] = [
  { value: 'WATCHED_DESC', label: 'Recently watched' },
  { value: 'RATED_DESC', label: 'Recently rated' },
  { value: 'RATING_DESC', label: 'Highest rated' },
  { value: 'RATING_ASC', label: 'Lowest rated' },
  { value: 'RELEASE_DESC', label: 'Newest release' },
  { value: 'RELEASE_ASC', label: 'Oldest release' },
  { value: 'TITLE', label: 'Title' },
];

const WATCHED_TYPES = [
  { value: 'all', label: 'All' },
  { value: 'films', label: 'Films' },
  { value: 'shows', label: 'Shows' },
] as const;

/**
 * Everything the member has watched, rated, or marked completed — not just
 * what has a diary entry — with their marks under each poster. The filters
 * live in the URL, so a filtered shelf is a link.
 */
function FilmsTab({ username, own }: { username: string; own: boolean }): JSX.Element {
  const [params, setParams] = useSearchParams();
  const type = WATCHED_TYPES.find((t) => t.value === params.get('type'))?.value ?? 'all';
  const sort = WATCHED_SORTS.find((o) => o.value === params.get('sort'))?.value ?? 'WATCHED_DESC';
  const decade = Number(params.get('decade')) || undefined;
  const genre = params.get('genre') ?? '';
  const liked = params.get('liked') === 'true';
  const rated = params.get('rated') === 'true';
  const filtered = type !== 'all' || !!decade || !!genre || liked || rated;

  /** Set or (with '' / the default) clear one filter, replacing history. */
  function set(key: string, value: string): void {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  const query = useInfiniteQuery({
    queryKey: ['profile', username, 'watched', { type, sort, decade, genre, liked, rated }],
    queryFn: ({ pageParam }) =>
      api.getProfileWatched(username, {
        type,
        sort,
        decade,
        genre: genre || undefined,
        // Flags are filters only when on; `false` would mean "not liked".
        liked: liked || undefined,
        rated: rated || undefined,
        cursor: pageParam,
        limit: 72,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const entries = query.data?.pages.flatMap((p) => p.entries) ?? [];
  // A genre from a link (a profile's own top genres) may not be in the fixed list.
  const genres: string[] = [...BROWSE_GENRES];
  if (genre && !genres.includes(genre)) genres.unshift(genre);
  const cell = 'w-full sm:w-auto';

  return (
    <div className="mt-6">
      <div className="grid grid-cols-2 items-center gap-2 border-b border-border pb-5 sm:flex sm:flex-wrap">
        <Segmented
          label="Films or shows"
          value={type}
          onChange={(v) => set('type', v === 'all' ? '' : v)}
          options={WATCHED_TYPES}
          className="col-span-2 w-fit sm:mr-1"
        />
        <Select
          value={decade ?? ''}
          onChange={(e) => set('decade', e.target.value)}
          aria-label="Decade"
          className={cell}
        >
          <option value="">Any decade</option>
          {decadeOptions().map((d) => (
            <option key={d} value={d}>
              {d}s
            </option>
          ))}
        </Select>
        <Select
          value={genre}
          onChange={(e) => set('genre', e.target.value)}
          aria-label="Genre"
          className={cell}
        >
          <option value="">Any genre</option>
          {genres.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </Select>
        <Select
          value={sort}
          onChange={(e) => set('sort', e.target.value === 'WATCHED_DESC' ? '' : e.target.value)}
          aria-label="Sort by"
          className={cn(cell, 'col-span-2 sm:col-span-1')}
        >
          {WATCHED_SORTS.map((o) => (
            <option key={o.value} value={o.value}>
              Sort: {o.label}
            </option>
          ))}
        </Select>
        <div className="col-span-2 flex gap-4 sm:ml-1">
          <Checkbox checked={liked} onChange={(e) => set('liked', e.target.checked ? 'true' : '')}>
            Liked
          </Checkbox>
          <Checkbox checked={rated} onChange={(e) => set('rated', e.target.checked ? 'true' : '')}>
            Rated
          </Checkbox>
        </div>
      </div>

      <div className="mt-6">
        {query.isLoading ? (
          <PosterGridSkeleton />
        ) : query.isError ? (
          <ErrorState compact onRetry={() => void query.refetch()} />
        ) : entries.length === 0 ? (
          <EmptyState
            compact
            title={filtered ? 'Nothing matches these filters' : 'Nothing watched yet'}
            action={
              filtered ? (
                <Button onClick={() => setParams({}, { replace: true })}>Clear filters</Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <PosterGrid>
              {entries.map((e) => (
                <Poster
                  key={e.media.id}
                  title={e.media.title}
                  year={e.media.year}
                  type={e.media.type}
                  posterUrl={e.media.posterUrl}
                  to={mediaHref(e.media, username)}
                  caption={
                    <span title={own ? 'Your rating' : `${username}'s rating`}>
                      <PosterMarks type={e.media.type} rating={e.rating} liked={e.liked} />
                    </span>
                  }
                />
              ))}
            </PosterGrid>
            <LoadMore query={query} />
          </>
        )}
      </div>
    </div>
  );
}

/* ---- Diary ---------------------------------------------------------------- */

function DiaryTab({ username, own }: { username: string; own: boolean }): JSX.Element {
  const [editing, setEditing] = useState<ProfileDiaryEntry | null>(null);
  const query = useInfiniteQuery({
    queryKey: ['profile', username, 'diary'],
    queryFn: ({ pageParam }) => api.getProfileDiary(username, { cursor: pageParam, limit: 50 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const entries = query.data?.pages.flatMap((p) => p.entries) ?? [];

  if (query.isLoading) return <Spinner center />;
  if (query.isError) return <ErrorState compact onRetry={() => void query.refetch()} />;
  if (entries.length === 0) {
    return (
      <EmptyState
        compact
        className="mt-6"
        title="No diary entries yet"
        body={own ? 'Log a title with a date and it lands here.' : undefined}
      />
    );
  }

  // Newest first from the server, so months arrive already in order. Watch
  // dates are stored at 12:00 UTC: the ISO prefix is the calendar month.
  const months: { key: string; entries: ProfileDiaryEntry[] }[] = [];
  for (const e of entries) {
    const key = e.watchedAt.slice(0, 7);
    const last = months[months.length - 1];
    if (last?.key === key) last.entries.push(e);
    else months.push({ key, entries: [e] });
  }

  return (
    <>
      <div className="mt-6 space-y-8">
        {months.map((m) => (
          <section key={m.key}>
            <SectionHeader
              title={formatMonth(`${m.key}-01T12:00:00.000Z`, { dateOnly: true })}
              count={m.entries.length}
            />
            <ul className="divide-y divide-border">
              {m.entries.map((e, i) => (
                <DiaryRow
                  key={e.id}
                  entry={e}
                  // The day is printed once; later entries that day sit under it.
                  showDay={m.entries[i - 1]?.watchedAt.slice(0, 10) !== e.watchedAt.slice(0, 10)}
                  onEdit={own ? () => setEditing(e) : undefined}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
      <LoadMore query={query} />
      {/* Outside the spaced stack: `space-y` would push the sheet off the foot. */}
      {editing && <EditDiaryEntry entry={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function DiaryRow({
  entry: e,
  showDay,
  onEdit,
}: {
  entry: ProfileDiaryEntry;
  showDay: boolean;
  onEdit?: () => void;
}): JSX.Element {
  const to = mediaHref(e.media);
  const rating = e.rating !== null && (
    <RatingMark
      value={e.rating}
      type={e.media.type}
      size={12}
      display={isEpisodic(e.media.type) ? 'number' : 'stars'}
    />
  );
  const mark = 'grid w-5 place-items-center';
  const liked = e.liked && (
    <span title="Liked" className={cn(mark, 'text-rose')}>
      <IconHeart filled className="h-3.5 w-3.5" />
      <span className="sr-only">Liked</span>
    </span>
  );
  const rewatch = e.isRewatch && (
    <span title="Rewatch" className={mark}>
      <IconRewatch className="h-3.5 w-3.5" />
      <span className="sr-only">Rewatch</span>
    </span>
  );
  return (
    <li className="flex items-center gap-3 py-2.5">
      <time
        dateTime={e.watchedAt.slice(0, 10)}
        className={cn(
          'w-9 shrink-0 text-center font-data text-[26px] font-bold leading-none',
          showDay ? 'text-muted' : 'text-transparent',
        )}
        aria-hidden={!showDay}
      >
        {Number(e.watchedAt.slice(8, 10))}
      </time>
      <PosterThumb title={e.media.title} posterUrl={e.media.posterUrl} to={to} size="xs" />
      <div className="min-w-0 flex-1">
        <Link to={to} className="group block">
          <span className="font-cond text-[17px] font-extrabold uppercase leading-tight tracking-[0.02em] text-content group-hover:text-gold">
            {e.media.title}
          </span>
          {e.media.year && (
            <span className="ml-2 font-data text-[13px] text-muted-2">{e.media.year}</span>
          )}
        </Link>
        {/* On a phone the marks sit under the title; there's no room beside it. */}
        {(rating || liked || rewatch) && (
          <p className="mt-1 flex items-center gap-1 text-muted-2 sm:hidden">
            {rating}
            {liked}
            {rewatch}
          </p>
        )}
      </div>
      {/* Fixed-width mark columns, so ratings and icons line up down the page. */}
      <span className="hidden w-24 shrink-0 justify-end sm:flex">{rating}</span>
      <span className="hidden w-10 shrink-0 items-center text-muted-2 sm:flex">
        <span className="w-5">{liked}</span>
        <span className="w-5">{rewatch}</span>
      </span>
      <span className="flex shrink-0 items-center text-muted-2">
        {e.reviewId ? (
          <Link
            to={`/review/${e.reviewId}`}
            title="Read the review"
            aria-label="Read the review"
            className="grid h-8 w-7 place-items-center hover:text-content coarse:h-11"
          >
            <IconReview className="h-4 w-4" />
          </Link>
        ) : (
          <span className="w-7" />
        )}
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit diary entry for ${e.media.title}`}
            title="Edit entry"
            className="grid h-8 w-7 place-items-center rounded-sm hover:bg-surface-2 hover:text-content coarse:h-11 coarse:w-9"
          >
            <IconEdit className="h-4 w-4" />
          </button>
        )}
      </span>
    </li>
  );
}

/** Correct a diary entry's date or rewatch flag, or strike it from the diary. */
function EditDiaryEntry({
  entry,
  onClose,
}: {
  entry: ProfileDiaryEntry;
  onClose: () => void;
}): JSX.Element {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [date, setDate] = useState(entry.watchedAt.slice(0, 10));
  const [isRewatch, setIsRewatch] = useState(entry.isRewatch);

  const done = (): void => {
    invalidateUserMedia(queryClient, entry.media.id);
    onClose();
  };
  const save = useMutation({
    mutationFn: () =>
      // Date-only on the server (stored at 12:00 UTC), so send that instant.
      api.updateWatchEntry(entry.id, { watchedAt: `${date}T12:00:00.000Z`, isRewatch }),
    onSuccess: done,
  });
  const remove = useMutation({
    mutationFn: () => api.deleteWatchEntry(entry.id),
    onSuccess: done,
  });
  const failed = save.error ?? remove.error;

  return (
    <Dialog
      title={entry.media.title}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button
            variant="danger"
            className="mr-auto"
            disabled={remove.isPending}
            onClick={async () => {
              const ok = await confirm({
                title: 'Remove this diary entry?',
                body: `Your ${entry.isRewatch ? 'rewatch' : 'watch'} of ${entry.media.title} will be removed from your diary. Your rating stays.`,
                confirmLabel: 'Remove',
                danger: true,
              });
              if (ok) remove.mutate();
            }}
          >
            Remove
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!date || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="font-cond text-[11px] font-bold uppercase tracking-[0.12em] text-muted-2">
            Watched on
          </span>
          <Input
            type="date"
            value={date}
            max={localDateString()}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 w-auto font-data coarse:h-11"
          />
        </label>
        <Checkbox checked={isRewatch} onChange={(e) => setIsRewatch(e.target.checked)}>
          I&rsquo;d seen it before (rewatch)
        </Checkbox>
        {failed && (
          <Notice>
            {failed instanceof ApiError ? failed.message : 'Could not save the entry'}
          </Notice>
        )}
      </div>
    </Dialog>
  );
}

/* ---- Reviews, likes, network ---------------------------------------------- */

function ReviewsTab({ username }: { username: string }): JSX.Element {
  const query = useInfiniteQuery({
    queryKey: ['profile', username, 'reviews'],
    queryFn: ({ pageParam }) => api.getProfileReviews(username, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const reviews = query.data?.pages.flatMap((p) => p.reviews) ?? [];

  if (query.isLoading) return <Spinner center />;
  if (reviews.length === 0) {
    return <EmptyState compact className="mt-6" title="No reviews yet" />;
  }
  return (
    <div className="mt-2">
      <div className="divide-y divide-border">
        {reviews.map((r) => (
          <UserReviewCard key={r.id} review={r} showAuthor={false} />
        ))}
      </div>
      <LoadMore query={query} />
    </div>
  );
}

const LIKE_KINDS: { value: ProfileLikesKind; label: string }[] = [
  { value: 'titles', label: 'Titles' },
  { value: 'reviews', label: 'Reviews' },
  { value: 'lists', label: 'Lists' },
];

function LikesTab({ username }: { username: string }): JSX.Element {
  const [params, setParams] = useSearchParams();
  const kind = LIKE_KINDS.find((k) => k.value === params.get('kind'))?.value ?? 'titles';
  const query = useInfiniteQuery({
    queryKey: ['profile', username, 'likes', kind],
    queryFn: ({ pageParam }) => api.getProfileLikes(username, kind, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const pages = query.data?.pages ?? [];
  const titles = pages.flatMap((p) => p.titles);
  const reviews = pages.flatMap((p) => p.reviews);
  const lists = pages.flatMap((p) => p.lists);

  return (
    <div className="mt-6">
      <Segmented
        label="Kind of like"
        className="mb-5"
        value={kind}
        onChange={(k) => setParams(k === 'titles' ? {} : { kind: k }, { replace: true })}
        options={LIKE_KINDS}
      />
      {query.isLoading ? (
        <Spinner center />
      ) : query.isError ? (
        <ErrorState compact onRetry={() => void query.refetch()} />
      ) : titles.length + reviews.length + lists.length === 0 ? (
        <EmptyState compact title={`No liked ${kind} yet`} />
      ) : (
        <>
          {kind === 'titles' && (
            <PosterGrid>
              {titles.map((t) => (
                <Poster
                  key={t.id}
                  title={t.title}
                  year={t.year}
                  type={t.type}
                  posterUrl={t.posterUrl}
                  to={mediaHref(t)}
                />
              ))}
            </PosterGrid>
          )}
          {kind === 'reviews' && (
            <div className="divide-y divide-border">
              {reviews.map((r) => (
                <UserReviewCard key={r.id} review={r} />
              ))}
            </div>
          )}
          {kind === 'lists' && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {lists.map((l) => (
                <ListCard key={l.id} list={l} />
              ))}
            </div>
          )}
          <LoadMore query={query} />
        </>
      )}
    </div>
  );
}

function NetworkTab({ username }: { username: string }): JSX.Element {
  const [params, setParams] = useSearchParams();
  const side = params.get('side') === 'following' ? 'following' : 'followers';
  const query = useInfiniteQuery({
    queryKey: ['profile', username, 'network', side],
    queryFn: ({ pageParam }) =>
      side === 'followers'
        ? api.getFollowers(username, pageParam)
        : api.getFollowing(username, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const members = query.data?.pages.flatMap((p) => p.members) ?? [];

  return (
    <div className="mt-6">
      <Segmented
        label="Followers or following"
        className="mb-4"
        value={side}
        onChange={(s) => setParams(s === 'following' ? { side: s } : {}, { replace: true })}
        options={[
          { value: 'followers', label: 'Followers' },
          { value: 'following', label: 'Following' },
        ]}
      />

      {query.isLoading ? (
        <Spinner center />
      ) : members.length === 0 ? (
        <EmptyState
          compact
          title={side === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
        />
      ) : (
        <>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {members.map((m) => (
              <MemberCard key={m.id} member={m} />
            ))}
          </div>
          <LoadMore query={query} />
        </>
      )}
    </div>
  );
}

/* ---- Header --------------------------------------------------------------- */

function ProfileHeader({
  profile,
  base,
  compact,
  onEditFavorites,
  onEditProfile,
}: {
  profile: PublicProfile;
  base: string;
  compact: boolean;
  onEditFavorites: () => void;
  onEditProfile: () => void;
}): JSX.Element {
  const avatar = { username: profile.username, avatarUrl: profile.avatarUrl };
  const favorites = [...profile.favoriteFilms, ...profile.favoriteShows].slice(0, 4);
  return (
    <div className={cn(compact && 'app:hidden')}>
      {/* Cover: the member's uploaded banner, or — the way a Letterboxd header
          is built from the account's own taste — a collage of their favourites. */}
      {!compact && (
        <div className="relative mb-10 app:-mx-4 app:-mt-4">
          <div className="relative h-40 overflow-hidden rounded-sm border border-border bg-surface-2 app:rounded-none app:border-0 sm:h-52">
            {profile.bannerUrl ? (
              <img
                src={profile.bannerUrl}
                alt=""
                decoding="async"
                fetchPriority="high"
                className="h-full w-full object-cover"
              />
            ) : favorites.length > 0 ? (
              <div className="grid h-full grid-cols-4">
                {Array.from({ length: 4 }, (_, i) => {
                  const f = favorites[i];
                  return f?.media.posterUrl ? (
                    <img
                      key={i}
                      src={f.media.posterUrl}
                      alt=""
                      decoding="async"
                      fetchPriority="high"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div
                      key={i}
                      style={{ background: posterGradient(f?.media.title ?? profile.username + i) }}
                    />
                  );
                })}
              </div>
            ) : (
              <div
                className="h-full w-full"
                style={{ background: posterGradient(profile.username) }}
              />
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-black/20" />
          </div>
          <div className="absolute -bottom-8 left-5 rounded-sm ring-4 ring-bg app:left-4">
            <Avatar user={avatar} size={80} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {compact && (
            <Link to={base} className="shrink-0">
              <Avatar user={avatar} size={44} />
            </Link>
          )}
          <div className="min-w-0">
            <h1 className="truncate font-cond text-2xl font-extrabold uppercase tracking-[0.02em]">
              <Link to={base}>{profile.displayName || profile.username}</Link>
            </h1>
            <p className="mt-0.5 font-data text-[13px] text-muted-2">
              @{profile.username} · joined {formatMonth(profile.joinedAt)}
            </p>
            {!compact && profile.bio && (
              <p className="mt-2 max-w-xl whitespace-pre-wrap text-sm text-muted">{profile.bio}</p>
            )}
          </div>
        </div>

        {profile.isOwnProfile
          ? !compact && (
              <div className="flex gap-2">
                <Button onClick={onEditFavorites}>Edit favorites</Button>
                <Button onClick={onEditProfile}>Edit profile</Button>
              </div>
            )
          : profile.isFollowedByViewer !== null && (
              <div className="flex items-center gap-2">
                {profile.followsViewer && (
                  <span className="font-cond text-[11px] font-bold uppercase tracking-[0.12em] text-cyan">
                    Follows you
                  </span>
                )}
                <FollowButton
                  username={profile.username}
                  initialFollowing={profile.isFollowedByViewer}
                />
              </div>
            )}
      </div>

      {!compact && <StatsRow profile={profile} base={base} />}
    </div>
  );
}

/**
 * The installed app's profile nav: a member's sections as rows, the way a
 * phone settings-style screen lists its places, each pushed as its own
 * screen. Replaces the website's tab strip, which on a phone scrolls sideways
 * with most of its words off-screen.
 */
function ProfileMenu({ profile, base }: { profile: PublicProfile; base: string }): JSX.Element {
  const films = profile.stats.moviesWatched + profile.stats.showsWatched;
  const rows: { label: string; to: string; count?: number }[] = [
    { label: 'Films', to: `${base}/films`, count: films },
    { label: 'Diary', to: `${base}/diary` },
    { label: 'Reviews', to: `${base}/reviews` },
    { label: 'Lists', to: `${base}/lists` },
    ...(profile.canViewWatchlist ? [{ label: 'Watchlist', to: `${base}/watchlist` }] : []),
    { label: 'Likes', to: `${base}/likes` },
    { label: 'Activity', to: `${base}/activity` },
    { label: 'Network', to: `${base}/network`, count: profile.followerCount },
    ...(profile.isOwnProfile
      ? [
          { label: 'Library', to: '/library' },
          { label: 'Settings', to: '/settings' },
        ]
      : []),
  ];
  return (
    <nav aria-label="Profile sections" className="-mx-4 hidden border-y border-border app:block">
      {rows.map((r) => (
        <Link
          key={r.label}
          to={r.to}
          className="flex min-h-[3rem] items-center gap-3 border-t border-border px-4 first:border-t-0 active:bg-surface-2"
        >
          <span className="flex-1 font-cond text-[15px] font-bold uppercase tracking-[0.08em]">
            {r.label}
          </span>
          {r.count !== undefined && (
            <span className="font-data text-[13px] text-muted-2">{r.count}</span>
          )}
          <IconChevronRight className="h-3.5 w-3.5 text-muted-2" />
        </Link>
      ))}
    </nav>
  );
}

/** The tallies, each one a door to the shelf it counts. */
function StatsRow({ profile, base }: { profile: PublicProfile; base: string }): JSX.Element {
  const stats = profile.stats;
  const items: { label: string; value: number; to?: string; wide?: true }[] = [
    { label: 'Films', value: stats.moviesWatched, to: `${base}/films?type=films` },
    { label: 'Shows', value: stats.showsWatched, to: `${base}/films?type=shows` },
    { label: 'Episodes', value: stats.episodesWatched, wide: true },
    { label: 'Ratings', value: stats.totalRatings, to: `${base}/films?rated=true`, wide: true },
    { label: 'Followers', value: profile.followerCount, to: `${base}/network` },
    { label: 'Following', value: profile.followingCount, to: `${base}/network?side=following` },
  ];
  return (
    <div className="mt-6 grid grid-cols-3 gap-3 border-t border-border pt-6 app:mt-5 app:grid-cols-4 app:gap-1 app:pt-4 sm:grid-cols-6">
      {items.map((i) => {
        const inner = (
          <>
            <p className="font-data text-2xl font-bold text-content app:text-xl">{i.value}</p>
            <p className="font-cond text-[11px] font-bold uppercase tracking-[0.16em] text-muted-2 group-hover:text-content">
              {i.label}
            </p>
          </>
        );
        return i.to ? (
          <Link
            key={i.label}
            to={i.to}
            className={cn('group block text-center', i.wide && 'app:hidden')}
          >
            {inner}
          </Link>
        ) : (
          <div key={i.label} className={cn('text-center', i.wide && 'app:hidden')}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}
