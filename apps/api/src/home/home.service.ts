import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  MediaType,
  type ActorSummary,
  type HomeFriendEntry,
  type HomePopularEntry,
  type HomeResponse,
  type MediaSummary,
} from '@cinelog/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { ArtworkService } from '../artwork/artwork.service';
import { mediaSummarySelect, type MediaSummaryRow } from '../common/media-select';
import { visibleUserWhere } from '../common/visibility';
import { ReviewsService } from '../reviews/reviews.service';
import { ListsService } from '../lists/lists.service';

const FRIEND_ENTRIES = 12;
const POPULAR_ENTRIES = 12;
const POPULAR_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const FRIEND_REVIEWS = 8;
const RECENT_LISTS = 6;
const actorSelect = { id: true, username: true, displayName: true, avatarUrl: true } as const;

/**
 * The signed-in home page: what the people you follow have been watching.
 * Every section filters authors through visibleUserWhere (profile visibility +
 * blocks both ways). Following nobody falls back to the whole instance
 * (`scope: 'EVERYONE'`), excluding the viewer's own activity.
 */
@Injectable()
export class HomeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly artwork: ArtworkService,
    private readonly reviews: ReviewsService,
    private readonly lists: ListsService,
  ) {}

  async getHome(viewerId: string): Promise<HomeResponse> {
    const following = await this.prisma.follow.findMany({
      where: { followerId: viewerId },
      select: { followingId: true },
    });
    const ids = following.map((f) => f.followingId);
    const scope = ids.length ? 'FOLLOWING' : 'EVERYONE';
    // Who counts as a "friend" here; visibility is applied on the relation.
    const userIdFilter = ids.length ? { in: ids } : { not: viewerId };
    const actor: Prisma.UserWhereInput = visibleUserWhere(viewerId);

    const [newFromFriends, popularWithFriends, friendReviewRows, friendLists] = await Promise.all([
      this.newFromFriends(userIdFilter, actor),
      this.popular(userIdFilter, actor),
      this.prisma.review.findMany({
        where: { userId: userIdFilter, targetType: 'MEDIA', user: actor },
        include: { user: true, media: { select: mediaSummarySelect } },
        orderBy: { createdAt: 'desc' },
        take: FRIEND_REVIEWS,
      }),
      ids.length
        ? this.lists.browse(viewerId, { sort: 'UPDATED', limit: RECENT_LISTS }, undefined, { ownerIds: ids })
        : null,
    ]);
    const useFriendLists = !!friendLists && friendLists.lists.length > 0;
    const recentLists = useFriendLists
      ? friendLists.lists
      : (await this.lists.browse(viewerId, { sort: 'POPULAR', limit: RECENT_LISTS })).lists;

    return {
      scope,
      newFromFriends,
      popularWithFriends,
      friendReviews: await this.reviews.toUserReviews(friendReviewRows, viewerId),
      recentLists,
      recentListsSource: useFriendLists ? 'FOLLOWING' : 'POPULAR',
    };
  }

  /** Latest watch/rate/review per (member, title), newest first. */
  private async newFromFriends(
    actorId: Prisma.StringFilter,
    actor: Prisma.UserWhereInput,
  ): Promise<HomeFriendEntry[]> {
    // Over-fetch: one member logging, rating and reviewing a title is 3 events.
    const events = await this.prisma.activityEvent.findMany({
      where: { actorId, actor, type: { in: ['WATCHED', 'RATED', 'REVIEWED'] }, mediaItemId: { not: null } },
      include: { actor: { select: actorSelect }, media: { select: mediaSummarySelect } },
      orderBy: { createdAt: 'desc' },
      take: FRIEND_ENTRIES * 5,
    });
    const seen = new Set<string>();
    const picked = events.filter((e) => {
      const key = `${e.actorId}:${e.mediaItemId}`;
      if (!e.media || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, FRIEND_ENTRIES);
    if (picked.length === 0) return [];

    // Superset lookups (actors × titles), narrowed to exact pairs by key.
    const actorIds = [...new Set(picked.map((e) => e.actorId))];
    const mediaIds = [...new Set(picked.map((e) => e.mediaItemId!))];
    const pair = { userId: { in: actorIds }, mediaItemId: { in: mediaIds } };
    const [ratings, likes, reviews, history] = await Promise.all([
      this.prisma.rating.findMany({ where: pair, select: { userId: true, mediaItemId: true, value: true } }),
      this.prisma.userMediaStatus.findMany({
        where: { ...pair, isFavorite: true },
        select: { userId: true, mediaItemId: true },
      }),
      this.prisma.review.findMany({
        where: { ...pair, targetType: 'MEDIA' },
        select: { id: true, userId: true, mediaItemId: true },
      }),
      this.prisma.watchHistory.findMany({
        where: pair,
        select: { userId: true, mediaItemId: true, isRewatch: true },
        orderBy: { watchedAt: 'desc' },
      }),
    ]);
    const k = (r: { userId: string; mediaItemId: string }): string => `${r.userId}:${r.mediaItemId}`;
    const ratingBy = new Map(ratings.map((r) => [k(r), r.value]));
    const likedBy = new Set(likes.map(k));
    const reviewBy = new Map(reviews.map((r) => [k(r), r.id]));
    const rewatchBy = new Map<string, boolean>();
    for (const h of history) if (!rewatchBy.has(k(h))) rewatchBy.set(k(h), h.isRewatch);

    return picked.map((e) => {
      const key = `${e.actorId}:${e.mediaItemId}`;
      return {
        id: e.id,
        type: e.type as HomeFriendEntry['type'],
        actor: e.actor,
        media: this.toSummary(e.media!),
        rating: ratingBy.get(key) ?? null,
        liked: likedBy.has(key),
        reviewId: reviewBy.get(key) ?? null,
        isRewatch: rewatchBy.get(key) ?? false,
        createdAt: e.createdAt.toISOString(),
      };
    });
  }

  /** Titles the most distinct friends logged or rated in the last week. */
  private async popular(
    actorId: Prisma.StringFilter,
    actor: Prisma.UserWhereInput,
  ): Promise<HomePopularEntry[]> {
    // ponytail: counts in JS over a capped week of events; a GROUP BY over
    // (actorId, mediaItemId) if instance-wide weeks ever exceed the cap.
    const events = await this.prisma.activityEvent.findMany({
      where: {
        actorId,
        actor,
        type: { in: ['WATCHED', 'RATED'] },
        mediaItemId: { not: null },
        createdAt: { gte: new Date(Date.now() - POPULAR_WINDOW_MS) },
      },
      include: { actor: { select: actorSelect }, media: { select: mediaSummarySelect } },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    });
    const byMedia = new Map<string, { media: MediaSummaryRow; members: Map<string, ActorSummary> }>();
    for (const e of events) {
      if (!e.media) continue;
      const entry = byMedia.get(e.media.id) ?? { media: e.media, members: new Map() };
      if (!entry.members.has(e.actorId)) entry.members.set(e.actorId, e.actor);
      byMedia.set(e.media.id, entry);
    }
    // Map order = first (most recent) sighting, so ties keep recency order.
    return [...byMedia.values()]
      .sort((a, b) => b.members.size - a.members.size)
      .slice(0, POPULAR_ENTRIES)
      .map((x) => ({
        media: this.toSummary(x.media),
        count: x.members.size,
        members: [...x.members.values()].slice(0, 3),
      }));
  }

  private toSummary(media: MediaSummaryRow): MediaSummary {
    return {
      id: media.id,
      type: MediaType.catch('MOVIE').parse(media.type),
      title: media.title,
      year: media.releaseDate ? Number(media.releaseDate.slice(0, 4)) || null : null,
      posterUrl: this.artwork.toProxyUrl(media.posterPath),
    };
  }
}
