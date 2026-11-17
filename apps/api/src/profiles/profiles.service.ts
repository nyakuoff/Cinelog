import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, User } from '@prisma/client';
import {
  MediaType,
  ProfileVisibility,
  type FavoriteSlot,
  type MediaSummary,
  type ProfileDiaryResponse,
  type ProfileWatchedResponse,
  type ProfileWatchlistResponse,
  type ProfileDiaryQuery,
  type ProfileLikesQuery,
  type ProfileLikesResponse,
  type ProfileWatchedEntry,
  type ProfileWatchedQuery,
  type PublicProfile,
  type UpdateFavoritesRequest,
  type UserReviewListResponse,
} from '@cinelog/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { mediaSummarySelect, watchedMediaWhere, type MediaSummaryRow } from '../common/media-select';
import { ArtworkService } from '../artwork/artwork.service';
import { ReviewsService } from '../reviews/reviews.service';
import { ListsService } from '../lists/lists.service';
import { isBlockedBetween } from '../common/visibility';

/** Types that count as "shows" for watch-stat purposes — everything episodic. */
const SHOW_TYPES = new Set<MediaType>(['TV', 'ANIME', 'CARTOON', 'MINISERIES', 'SPECIAL']);
/** "Films" on the Watched tab's type filter — the complement of SHOW_TYPES. */
const FILM_TYPES = new Set<MediaType>(['MOVIE', 'DOCUMENTARY']);

@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly artwork: ArtworkService,
    private readonly reviews: ReviewsService,
    private readonly lists: ListsService,
  ) {}

  private toSummary(media: MediaSummaryRow): MediaSummary {
    return {
      id: media.id,
      type: MediaType.catch('MOVIE').parse(media.type),
      title: media.title,
      year: media.releaseDate ? Number(media.releaseDate.slice(0, 4)) || null : null,
      posterUrl: this.artwork.toProxyUrl(media.posterPath),
    };
  }

  /** Overlays `ownerId`'s own poster overrides onto a list of media summaries,
   *  mutating in place. A poster override travels with its owner's library —
   *  so anyone browsing this profile's diary/watchlist/watched/favorites sees
   *  the owner's chosen poster, the same as the owner does themselves. It
   *  never applies when the title is shown outside that owner's context
   *  (Discover, Films browse, another member's own library). */
  private async applyOwnerPosters(ownerId: string, medias: MediaSummary[]): Promise<void> {
    if (medias.length === 0) return;
    const overrides = await this.prisma.userPosterOverride.findMany({
      where: { userId: ownerId }, // the owner's overrides are few; avoids a big IN list
      select: { mediaItemId: true, url: true },
    });
    if (overrides.length === 0) return;
    const byId = new Map(overrides.map((o) => [o.mediaItemId, o.url]));
    for (const m of medias) {
      const url = byId.get(m.id);
      if (url) m.posterUrl = this.artwork.toProxyUrl(url);
    }
  }

  /** Newest first, keyset-paginated on (watchedAt, id) — the cursor is the
   *  last entry's `watchedAt|id`. */
  async getDiary(
    username: string,
    viewerId: string | undefined,
    query: Partial<ProfileDiaryQuery> = {},
  ): Promise<ProfileDiaryResponse> {
    const user = await this.findUserOrThrow(username);
    const { canView } = await this.resolveAccess(user, viewerId);
    if (!canView) return { entries: [], nextCursor: null };

    const limit = query.limit ?? 100;
    const where: Prisma.WatchHistoryWhereInput = { userId: user.id };
    // Month/year windows in UTC: date-only watches are stored at 12:00 UTC,
    // so they never straddle a boundary.
    if (query.year) {
      const from = new Date(Date.UTC(query.year, query.month ? query.month - 1 : 0, 1));
      const to = new Date(Date.UTC(query.month ? query.year : query.year + 1, query.month ?? 0, 1));
      where.watchedAt = { gte: from, lt: to };
    }
    const cursor = parseDiaryCursor(query.cursor);
    if (cursor) {
      where.OR = [
        { watchedAt: { lt: cursor.at } },
        { watchedAt: cursor.at, id: { lt: cursor.id } },
      ];
    }

    const history = await this.prisma.watchHistory.findMany({
      where,
      include: { media: { select: mediaSummarySelect } },
      orderBy: [{ watchedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const hasMore = history.length > limit;
    const page = hasMore ? history.slice(0, limit) : history;

    const mediaIds = [...new Set(page.map((h) => h.mediaItemId))];
    const [ratings, liked, reviews] = mediaIds.length
      ? await Promise.all([
          this.prisma.rating.findMany({
            where: { userId: user.id, mediaItemId: { in: mediaIds } },
            select: { mediaItemId: true, value: true },
          }),
          this.prisma.userMediaStatus.findMany({
            where: { userId: user.id, mediaItemId: { in: mediaIds }, isFavorite: true },
            select: { mediaItemId: true },
          }),
          this.prisma.review.findMany({
            where: { userId: user.id, mediaItemId: { in: mediaIds }, targetType: 'MEDIA' },
            select: { id: true, mediaItemId: true },
          }),
        ])
      : [[], [], []];
    const ratingByMedia = new Map(ratings.map((r) => [r.mediaItemId, r.value]));
    const likedSet = new Set(liked.map((l) => l.mediaItemId));
    const reviewByMedia = new Map(reviews.map((r) => [r.mediaItemId, r.id]));

    const entries = page.map((h) => ({
      id: h.id,
      media: this.toSummary(h.media),
      watchedAt: h.watchedAt.toISOString(),
      isRewatch: h.isRewatch,
      rating: ratingByMedia.get(h.mediaItemId) ?? null,
      liked: likedSet.has(h.mediaItemId),
      reviewId: reviewByMedia.get(h.mediaItemId) ?? null,
    }));
    await this.applyOwnerPosters(user.id, entries.map((e) => e.media));
    const last = page[page.length - 1];
    return {
      entries,
      nextCursor: hasMore && last ? `${last.watchedAt.toISOString()}|${last.id}` : null,
    };
  }

  async getWatchlist(username: string, viewerId: string | undefined): Promise<ProfileWatchlistResponse> {
    const user = await this.findUserOrThrow(username);
    const { canViewWatchlist } = await this.resolveAccess(user, viewerId);
    if (!canViewWatchlist) return { items: [] };

    const rows = await this.prisma.userMediaStatus.findMany({
      where: { userId: user.id, isWatchlisted: true },
      include: { media: { select: mediaSummarySelect } },
      orderBy: { updatedAt: 'desc' },
    });
    const items = rows.map((r) => this.toSummary(r.media));
    await this.applyOwnerPosters(user.id, items);
    return { items };
  }

  async getReviews(
    username: string,
    viewerId: string | undefined,
    cursor?: string,
  ): Promise<UserReviewListResponse> {
    const user = await this.findUserOrThrow(username);
    const { canView } = await this.resolveAccess(user, viewerId);
    if (!canView) return { reviews: [], nextCursor: null };
    const result = await this.reviews.listByAuthor(user.id, viewerId, cursor);
    await this.applyOwnerPosters(user.id, result.reviews.map((r) => r.media));
    return result;
  }

  async getPublicProfile(username: string, viewerId: string | undefined): Promise<PublicProfile> {
    const user = await this.findUserOrThrow(username);
    const { isOwnProfile, canView, canViewWatchlist, profileVisibility, watchlistVisibility } =
      await this.resolveAccess(user, viewerId);

    const [followerCount, followingCount, viewerFollows, followsViewer] = await Promise.all([
      this.prisma.follow.count({ where: { followingId: user.id } }),
      this.prisma.follow.count({ where: { followerId: user.id } }),
      viewerId
        ? this.prisma.follow.findUnique({
            where: { followerId_followingId: { followerId: viewerId, followingId: user.id } },
          })
        : Promise.resolve(null),
      viewerId
        ? this.prisma.follow.findUnique({
            where: { followerId_followingId: { followerId: user.id, followingId: viewerId } },
          })
        : Promise.resolve(null),
    ]);

    const base: PublicProfile = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bannerUrl: user.bannerUrl,
      bio: null,
      joinedAt: user.createdAt.toISOString(),
      isOwnProfile,
      profileVisibility,
      watchlistVisibility,
      canView,
      canViewWatchlist,
      favoriteFilms: [],
      favoriteShows: [],
      stats: { moviesWatched: 0, showsWatched: 0, episodesWatched: 0, totalRatings: 0, averageRating: null },
      ratingDistribution: [],
      topGenres: [],
      followerCount,
      followingCount,
      isFollowedByViewer: viewerId ? !!viewerFollows : null,
      followsViewer: viewerId ? !!followsViewer : null,
    };
    if (!canView) return base;

    const [favoriteFilmRows, favoriteShowRows, [moviesWatched, showsWatched], ratingGroups, episodeRatingCount, genreRows] =
      await Promise.all([
      this.prisma.userMediaStatus.findMany({
        where: { userId: user.id, favoritePosition: { not: null } },
        include: { media: { select: mediaSummarySelect } },
        orderBy: { favoritePosition: 'asc' },
      }),
      this.prisma.userMediaStatus.findMany({
        where: { userId: user.id, favoriteShowPosition: { not: null } },
        include: { media: { select: mediaSummarySelect } },
        orderBy: { favoriteShowPosition: 'asc' },
      }),
      // Same membership test as the Watched tab (see watchedMediaWhere), counted in SQL.
      Promise.all([
        this.prisma.mediaItem.count({ where: { AND: [watchedMediaWhere(user.id), { type: { in: [...FILM_TYPES] } }] } }),
        this.prisma.mediaItem.count({
          where: { AND: [watchedMediaWhere(user.id), { type: { in: [...SHOW_TYPES] } }] },
        }),
      ]),
      this.prisma.rating.groupBy({ by: ['value'], where: { userId: user.id }, _count: { _all: true } }),
      this.prisma.episodeRating.count({ where: { userId: user.id } }),
      this.prisma.mediaItem.findMany({
        where: { ratings: { some: { userId: user.id } } },
        select: { genres: { select: { name: true } } },
      }),
    ]);

    const favoriteFilms: FavoriteSlot[] = favoriteFilmRows
      .filter((r) => r.favoritePosition != null)
      .map((r) => ({ position: r.favoritePosition as number, media: this.toSummary(r.media) }));
    const favoriteShows: FavoriteSlot[] = favoriteShowRows
      .filter((r) => r.favoriteShowPosition != null)
      .map((r) => ({ position: r.favoriteShowPosition as number, media: this.toSummary(r.media) }));
    await this.applyOwnerPosters(user.id, [
      ...favoriteFilms.map((f) => f.media),
      ...favoriteShows.map((f) => f.media),
    ]);

    const totalRatings = ratingGroups.reduce((n, g) => n + g._count._all, 0);
    const averageRating = totalRatings
      ? Math.round((ratingGroups.reduce((sum, g) => sum + g.value * g._count._all, 0) / totalRatings) * 10) / 10
      : null;

    const buckets = new Map<number, number>();
    for (const g of ratingGroups) {
      const bucket = Math.min(10, Math.max(1, Math.ceil(g.value / 10)));
      buckets.set(bucket, (buckets.get(bucket) ?? 0) + g._count._all);
    }
    const ratingDistribution = Array.from({ length: 10 }, (_, i) => ({
      bucket: i + 1,
      count: buckets.get(i + 1) ?? 0,
    }));

    const genreCounts = new Map<string, number>();
    for (const row of genreRows) {
      for (const g of row.genres) genreCounts.set(g.name, (genreCounts.get(g.name) ?? 0) + 1);
    }
    const topGenres = Array.from(genreCounts.entries())
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return {
      ...base,
      bio: user.bio,
      favoriteFilms,
      favoriteShows,
      stats: {
        moviesWatched,
        showsWatched,
        // Episode-level "watched" state isn't tracked separately from ratings in
        // the current schema, so this counts rated episodes as a proxy.
        episodesWatched: episodeRatingCount,
        totalRatings,
        averageRating,
      },
      ratingDistribution,
      topGenres,
    };
  }

  async setFavorites(
    userId: string,
    dto: UpdateFavoritesRequest,
  ): Promise<{ favoriteFilms: FavoriteSlot[]; favoriteShows: FavoriteSlot[] }> {
    if (dto.filmIds) await this.applyFavoriteSide(userId, dto.filmIds, 'FILM');
    if (dto.showIds) await this.applyFavoriteSide(userId, dto.showIds, 'SHOW');

    const [filmRows, showRows] = await Promise.all([
      this.prisma.userMediaStatus.findMany({
        where: { userId, favoritePosition: { not: null } },
        include: { media: { select: mediaSummarySelect } },
        orderBy: { favoritePosition: 'asc' },
      }),
      this.prisma.userMediaStatus.findMany({
        where: { userId, favoriteShowPosition: { not: null } },
        include: { media: { select: mediaSummarySelect } },
        orderBy: { favoriteShowPosition: 'asc' },
      }),
    ]);
    return {
      favoriteFilms: filmRows
        .filter((r) => r.favoritePosition != null)
        .map((r) => ({ position: r.favoritePosition as number, media: this.toSummary(r.media) })),
      favoriteShows: showRows
        .filter((r) => r.favoriteShowPosition != null)
        .map((r) => ({ position: r.favoriteShowPosition as number, media: this.toSummary(r.media) })),
    };
  }

  private async applyFavoriteSide(
    userId: string,
    mediaIds: string[],
    side: 'FILM' | 'SHOW',
  ): Promise<void> {
    const ids = [...new Set(mediaIds)];
    if (ids.length !== mediaIds.length) {
      throw new BadRequestException('Duplicate media in favorites');
    }
    if (ids.length) {
      const items = await this.prisma.mediaItem.findMany({
        where: { id: { in: ids } },
        select: { id: true, type: true },
      });
      if (items.length !== ids.length) throw new BadRequestException('One or more titles were not found');
      const wrongType = items.some((m) => (side === 'FILM') !== (m.type === 'MOVIE'));
      if (wrongType) {
        throw new BadRequestException(
          side === 'FILM' ? 'Favorite films must be movies' : 'Favorite shows can\'t be movies',
        );
      }
    }

    if (side === 'FILM') {
      await this.prisma.$transaction([
        this.prisma.userMediaStatus.updateMany({
          where: { userId, favoritePosition: { not: null } },
          data: { favoritePosition: null },
        }),
        ...ids.map((mediaItemId, i) =>
          this.prisma.userMediaStatus.upsert({
            where: { userId_mediaItemId: { userId, mediaItemId } },
            create: { userId, mediaItemId, favoritePosition: i + 1 },
            update: { favoritePosition: i + 1 },
          }),
        ),
      ]);
    } else {
      await this.prisma.$transaction([
        this.prisma.userMediaStatus.updateMany({
          where: { userId, favoriteShowPosition: { not: null } },
          data: { favoriteShowPosition: null },
        }),
        ...ids.map((mediaItemId, i) =>
          this.prisma.userMediaStatus.upsert({
            where: { userId_mediaItemId: { userId, mediaItemId } },
            create: { userId, mediaItemId, favoriteShowPosition: i + 1 },
            update: { favoriteShowPosition: i + 1 },
          }),
        ),
      ]);
    }
  }

  /** Every title the member has ever watched — the "Watched" tab, a poster
   *  grid mirroring Letterboxd's Films tab. "Watched" means a diary entry, a
   *  rating, or a status of COMPLETED; a title can arrive via any of those
   *  without the other two (e.g. rating something without logging a date),
   *  and previously only diary entries counted, which badly undercounted
   *  both this list and the profile's Films/Shows stats.
   *
   *  Type/decade/genre filter in SQL; sort, liked/rated filters, and the
   *  offset page are applied in memory over the member's watched set.
   *  ponytail: whole-library scan per page; fine at self-hosted library
   *  sizes (thousands), move sorts into SQL if libraries get much larger. */
  async getWatched(
    username: string,
    viewerId: string | undefined,
    query: Partial<ProfileWatchedQuery> = {},
  ): Promise<ProfileWatchedResponse> {
    const user = await this.findUserOrThrow(username);
    const { canView } = await this.resolveAccess(user, viewerId);
    if (!canView) return { entries: [], nextCursor: null };

    const [entries, likedRows] = await Promise.all([
      this.getWatchedEntries(user.id),
      this.prisma.userMediaStatus.findMany({
        where: { userId: user.id, isFavorite: true },
        select: { mediaItemId: true },
      }),
    ]);
    if (entries.size === 0) return { entries: [], nextCursor: null };
    const likedSet = new Set(likedRows.map((l) => l.mediaItemId));

    const type = query.type ?? 'all';
    const filters: Prisma.MediaItemWhereInput[] = [watchedMediaWhere(user.id)];
    if (type !== 'all') filters.push({ type: type === 'films' ? { in: [...FILM_TYPES] } : { notIn: [...FILM_TYPES] } });
    if (query.decade) {
      filters.push({ releaseDate: { gte: `${query.decade}-01-01`, lt: `${query.decade + 10}-01-01` } });
    }
    if (query.genre) filters.push({ genres: { some: { name: query.genre } } });
    // Relation filter instead of `id IN (...)`: no variable-limit worries on big libraries.
    const media = await this.prisma.mediaItem.findMany({
      where: { AND: filters },
      select: mediaSummarySelect,
    });

    type Row = { m: MediaSummaryRow; rating: number | null; ratedAt: Date | null; at: Date };
    let rows: Row[] = [];
    for (const m of media) {
      const e = entries.get(m.id);
      if (e) rows.push({ m, rating: e.rating, ratedAt: e.ratedAt, at: e.activityAt });
    }
    if (query.liked !== undefined) rows = rows.filter((r) => likedSet.has(r.m.id) === query.liked);
    if (query.rated !== undefined) rows = rows.filter((r) => (r.rating !== null) === query.rated);

    // Nulls (unrated / undated) always sort last; ties fall back to newest activity.
    const nullsLast = <T>(a: T | null, b: T | null, cmp: (x: T, y: T) => number): number =>
      a === null ? (b === null ? 0 : 1) : b === null ? -1 : cmp(a, b);
    const byAt = (a: Row, b: Row): number => b.at.getTime() - a.at.getTime();
    const sorters: Record<NonNullable<ProfileWatchedQuery['sort']>, (a: Row, b: Row) => number> = {
      WATCHED_DESC: byAt,
      RATING_DESC: (a, b) => nullsLast(a.rating, b.rating, (x, y) => y - x) || byAt(a, b),
      RATING_ASC: (a, b) => nullsLast(a.rating, b.rating, (x, y) => x - y) || byAt(a, b),
      RELEASE_DESC: (a, b) => nullsLast(a.m.releaseDate, b.m.releaseDate, (x, y) => y.localeCompare(x)) || byAt(a, b),
      RELEASE_ASC: (a, b) => nullsLast(a.m.releaseDate, b.m.releaseDate, (x, y) => x.localeCompare(y)) || byAt(a, b),
      TITLE: (a, b) => a.m.title.localeCompare(b.m.title, undefined, { sensitivity: 'base' }) || byAt(a, b),
      RATED_DESC: (a, b) => nullsLast(a.ratedAt, b.ratedAt, (x, y) => y.getTime() - x.getTime()) || byAt(a, b),
    };
    rows.sort(sorters[query.sort ?? 'WATCHED_DESC']);

    // No limit = everything (the original, unpaginated contract).
    const skip = query.cursor ? Number(query.cursor) || 0 : 0;
    const page = query.limit ? rows.slice(skip, skip + query.limit) : rows;
    const result: ProfileWatchedEntry[] = page.map((r) => ({
      media: this.toSummary(r.m),
      rating: r.rating,
      watchedAt: r.at.toISOString(),
      liked: likedSet.has(r.m.id),
    }));
    await this.applyOwnerPosters(user.id, result.map((e) => e.media));
    return {
      entries: result,
      nextCursor: query.limit && skip + query.limit < rows.length ? String(skip + query.limit) : null,
    };
  }

  /** Titles, reviews, or lists the member has liked — each filtered to what
   *  the viewer may see, behind the member's own profile visibility. */
  async getLikes(
    username: string,
    viewerId: string | undefined,
    query: ProfileLikesQuery,
  ): Promise<ProfileLikesResponse> {
    const user = await this.findUserOrThrow(username);
    const { canView } = await this.resolveAccess(user, viewerId);
    const empty: ProfileLikesResponse = { kind: query.kind, titles: [], reviews: [], lists: [], nextCursor: null };
    if (!canView) return empty;

    if (query.kind === 'reviews') {
      const r = await this.reviews.listLikedBy(user.id, viewerId, query.cursor, query.limit);
      return { ...empty, reviews: r.reviews, nextCursor: r.nextCursor };
    }
    if (query.kind === 'lists') {
      const r = await this.lists.listLikedBy(user.id, viewerId, query.cursor, query.limit);
      return { ...empty, lists: r.lists, nextCursor: r.nextCursor };
    }
    const skip = query.cursor ? Number(query.cursor) || 0 : 0;
    const rows = await this.prisma.userMediaStatus.findMany({
      where: { userId: user.id, isFavorite: true },
      include: { media: { select: mediaSummarySelect } },
      orderBy: { updatedAt: 'desc' },
      take: query.limit,
      skip,
    });
    const titles = rows.map((r) => this.toSummary(r.media));
    await this.applyOwnerPosters(user.id, titles);
    return { ...empty, titles, nextCursor: rows.length >= query.limit ? String(skip + query.limit) : null };
  }

  /** Unions watch history, ratings, and COMPLETED status into one "have they
   *  watched this" membership map, keyed by media id, keeping the latest
   *  rating and the most recent relevant timestamp for each title. */
  private async getWatchedEntries(
    userId: string,
  ): Promise<Map<string, { rating: number | null; ratedAt: Date | null; activityAt: Date }>> {
    const [history, ratings, completed] = await Promise.all([
      this.prisma.watchHistory.findMany({
        where: { userId },
        select: { mediaItemId: true, watchedAt: true },
      }),
      this.prisma.rating.findMany({
        where: { userId },
        select: { mediaItemId: true, value: true, updatedAt: true },
      }),
      this.prisma.userMediaStatus.findMany({
        where: { userId, status: 'COMPLETED' },
        select: { mediaItemId: true, updatedAt: true },
      }),
    ]);

    const entries = new Map<string, { rating: number | null; ratedAt: Date | null; activityAt: Date }>();
    const touch = (mediaItemId: string, at: Date, rating?: number): void => {
      const cur = entries.get(mediaItemId);
      if (!cur) {
        entries.set(mediaItemId, {
          rating: rating ?? null,
          ratedAt: rating !== undefined ? at : null,
          activityAt: at,
        });
        return;
      }
      if (rating !== undefined) {
        cur.rating = rating;
        cur.ratedAt = at;
      }
      if (at > cur.activityAt) cur.activityAt = at;
    };
    for (const h of history) touch(h.mediaItemId, h.watchedAt);
    for (const c of completed) touch(c.mediaItemId, c.updatedAt);
    for (const r of ratings) touch(r.mediaItemId, r.updatedAt, r.value);
    return entries;
  }

  private async findUserOrThrow(username: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async resolveAccess(
    user: User,
    viewerId: string | undefined,
  ): Promise<{
    isOwnProfile: boolean;
    canView: boolean;
    canViewWatchlist: boolean;
    profileVisibility: ProfileVisibility;
    watchlistVisibility: ProfileVisibility;
  }> {
    // A block in either direction makes the profile not exist for the other
    // party — 404, so the block itself isn't confirmed by a different error.
    if (await isBlockedBetween(this.prisma, user.id, viewerId)) {
      throw new NotFoundException('User not found');
    }
    const isOwnProfile = viewerId === user.id;
    const profileVisibility = ProfileVisibility.catch('PUBLIC').parse(user.profileVisibility);
    const watchlistVisibility = ProfileVisibility.catch('PUBLIC').parse(user.watchlistVisibility);
    const canView = isOwnProfile || (await this.isVisibleTo(profileVisibility, user.id, viewerId));
    const canViewWatchlist =
      isOwnProfile || (canView && (await this.isVisibleTo(watchlistVisibility, user.id, viewerId)));
    return { isOwnProfile, canView, canViewWatchlist, profileVisibility, watchlistVisibility };
  }

  /** Whether `viewerId` (possibly anonymous) may see something gated by `visibility`
   *  on `ownerId`'s account. */
  private async isVisibleTo(
    visibility: ProfileVisibility,
    ownerId: string,
    viewerId: string | undefined,
  ): Promise<boolean> {
    if (visibility === 'PUBLIC') return true;
    if (visibility === 'PRIVATE') return false;
    if (!viewerId) return false;
    const follow = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: viewerId, followingId: ownerId } },
    });
    return !!follow;
  }
}

/** `watchedAt|id` from a diary page's nextCursor; null if absent or malformed. */
function parseDiaryCursor(cursor: string | undefined): { at: Date; id: string } | null {
  if (!cursor) return null;
  const sep = cursor.indexOf('|');
  if (sep < 0) return null;
  const at = new Date(cursor.slice(0, sep));
  const id = cursor.slice(sep + 1);
  return Number.isNaN(at.getTime()) || !id ? null : { at, id };
}
