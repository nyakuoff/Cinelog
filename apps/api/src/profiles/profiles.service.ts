import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { MediaItem, User } from '@prisma/client';
import {
  MediaType,
  ProfileVisibility,
  type FavoriteSlot,
  type MediaSummary,
  type ProfileDiaryResponse,
  type ProfileWatchedResponse,
  type ProfileWatchlistResponse,
  type PublicProfile,
  type UpdateFavoritesRequest,
  type UserReviewListResponse,
} from '@cinelog/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { ArtworkService } from '../artwork/artwork.service';
import { ReviewsService } from '../reviews/reviews.service';

/** Types that count as "shows" for watch-stat purposes — everything episodic. */
const SHOW_TYPES = new Set<MediaType>(['TV', 'ANIME', 'CARTOON', 'MINISERIES', 'SPECIAL']);

@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly artwork: ArtworkService,
    private readonly reviews: ReviewsService,
  ) {}

  private toSummary(media: MediaItem): MediaSummary {
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
      where: { userId: ownerId, mediaItemId: { in: medias.map((m) => m.id) } },
    });
    if (overrides.length === 0) return;
    const byId = new Map(overrides.map((o) => [o.mediaItemId, o.url]));
    for (const m of medias) {
      const url = byId.get(m.id);
      if (url) m.posterUrl = this.artwork.toProxyUrl(url);
    }
  }

  async getDiary(username: string, viewerId: string | undefined): Promise<ProfileDiaryResponse> {
    const user = await this.findUserOrThrow(username);
    const { canView } = await this.resolveAccess(user, viewerId);
    if (!canView) return { entries: [] };

    const history = await this.prisma.watchHistory.findMany({
      where: { userId: user.id },
      include: { media: true },
      orderBy: { watchedAt: 'desc' },
      take: 100,
    });
    const mediaIds = history.map((h) => h.mediaItemId);
    const ratings = mediaIds.length
      ? await this.prisma.rating.findMany({ where: { userId: user.id, mediaItemId: { in: mediaIds } } })
      : [];
    const ratingByMedia = new Map(ratings.map((r) => [r.mediaItemId, r.value]));

    const entries = history.map((h) => ({
      id: h.id,
      media: this.toSummary(h.media),
      watchedAt: h.watchedAt.toISOString(),
      isRewatch: h.isRewatch,
      rating: ratingByMedia.get(h.mediaItemId) ?? null,
    }));
    await this.applyOwnerPosters(user.id, entries.map((e) => e.media));
    return { entries };
  }

  async getWatchlist(username: string, viewerId: string | undefined): Promise<ProfileWatchlistResponse> {
    const user = await this.findUserOrThrow(username);
    const { canViewWatchlist } = await this.resolveAccess(user, viewerId);
    if (!canViewWatchlist) return { items: [] };

    const rows = await this.prisma.userMediaStatus.findMany({
      where: { userId: user.id, isWatchlisted: true },
      include: { media: true },
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

    const [favoriteFilmRows, favoriteShowRows, watchedEntries, ratings, episodeRatingCount, genreRows] =
      await Promise.all([
      this.prisma.userMediaStatus.findMany({
        where: { userId: user.id, favoritePosition: { not: null } },
        include: { media: true },
        orderBy: { favoritePosition: 'asc' },
      }),
      this.prisma.userMediaStatus.findMany({
        where: { userId: user.id, favoriteShowPosition: { not: null } },
        include: { media: true },
        orderBy: { favoriteShowPosition: 'asc' },
      }),
      this.getWatchedEntries(user.id),
      this.prisma.rating.findMany({ where: { userId: user.id }, select: { value: true } }),
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

    // Same membership test that powers the "Watched" tab, so the counts here
    // always match what's actually in that grid.
    const watchedIds = [...watchedEntries.keys()];
    const watchedTypes = watchedIds.length
      ? await this.prisma.mediaItem.findMany({
          where: { id: { in: watchedIds } },
          select: { type: true },
        })
      : [];
    const moviesWatched = watchedTypes.filter((m) => m.type === 'MOVIE').length;
    const showsWatched = watchedTypes.filter((m) =>
      SHOW_TYPES.has(MediaType.catch('MOVIE').parse(m.type)),
    ).length;
    const totalRatings = ratings.length;
    const averageRating = totalRatings
      ? Math.round((ratings.reduce((sum, r) => sum + r.value, 0) / totalRatings) * 10) / 10
      : null;

    const buckets = new Map<number, number>();
    for (const r of ratings) {
      const bucket = Math.min(10, Math.max(1, Math.ceil(r.value / 10)));
      buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
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
        include: { media: true },
        orderBy: { favoritePosition: 'asc' },
      }),
      this.prisma.userMediaStatus.findMany({
        where: { userId, favoriteShowPosition: { not: null } },
        include: { media: true },
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
   *  both this list and the profile's Films/Shows stats. */
  async getWatched(username: string, viewerId: string | undefined): Promise<ProfileWatchedResponse> {
    const user = await this.findUserOrThrow(username);
    const { canView } = await this.resolveAccess(user, viewerId);
    if (!canView) return { entries: [] };

    const entries = await this.getWatchedEntries(user.id);
    const ids = [...entries.keys()];
    if (ids.length === 0) return { entries: [] };

    const media = await this.prisma.mediaItem.findMany({ where: { id: { in: ids } } });
    const byId = new Map(media.map((m) => [m.id, m]));

    const result = ids
      .map((id) => {
        const m = byId.get(id);
        const e = entries.get(id);
        if (!m || !e) return null;
        return { media: this.toSummary(m), rating: e.rating, watchedAt: e.activityAt.toISOString() };
      })
      .filter((e): e is { media: MediaSummary; rating: number | null; watchedAt: string } => e !== null)
      .sort((a, b) => new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime());
    await this.applyOwnerPosters(user.id, result.map((e) => e.media));
    return { entries: result };
  }

  /** Unions watch history, ratings, and COMPLETED status into one "have they
   *  watched this" membership map, keyed by media id, keeping the latest
   *  rating and the most recent relevant timestamp for each title. */
  private async getWatchedEntries(
    userId: string,
  ): Promise<Map<string, { rating: number | null; activityAt: Date }>> {
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

    const entries = new Map<string, { rating: number | null; activityAt: Date }>();
    const touch = (mediaItemId: string, at: Date, rating?: number): void => {
      const cur = entries.get(mediaItemId);
      if (!cur) {
        entries.set(mediaItemId, { rating: rating ?? null, activityAt: at });
        return;
      }
      if (rating !== undefined) cur.rating = rating;
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
