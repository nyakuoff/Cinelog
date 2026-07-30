import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { MediaItem, User } from '@prisma/client';
import {
  ActivityType,
  MediaType,
  type ActivityFeedQuery,
  type ActivityFeedResponse,
  type ActivityItem,
  type FollowStateResponse,
  type MediaSummary,
  type MemberListQuery,
  type MemberListResponse,
  type MemberSummary,
} from '@cinelog/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { ArtworkService } from '../artwork/artwork.service';
import { ActivityService } from './activity.service';

/** Events by the same actor, of the same type, within this window collapse into
 *  one feed row so a batch import or a rating spree doesn't flood the feed. */
const GROUP_WINDOW_MS = 60 * 60 * 1000;

@Injectable()
export class SocialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly artwork: ArtworkService,
    private readonly activity: ActivityService,
  ) {}

  // -- follows -----------------------------------------------------------------

  async follow(viewerId: string, username: string): Promise<FollowStateResponse> {
    const target = await this.findUserOrThrow(username);
    if (target.id === viewerId) throw new BadRequestException('You cannot follow yourself');
    if (await this.eitherBlocks(viewerId, target.id)) {
      throw new BadRequestException('You cannot follow this member');
    }

    try {
      await this.prisma.follow.create({
        data: { followerId: viewerId, followingId: target.id },
      });
      await this.activity.record({
        actorId: viewerId,
        type: 'FOLLOWED',
        targetUserId: target.id,
      });
    } catch (err) {
      // Unique [followerId, followingId] makes a repeat follow a no-op.
      if (!isUniqueConstraintError(err)) throw err;
    }
    return this.followState(viewerId, target.id);
  }

  async unfollow(viewerId: string, username: string): Promise<FollowStateResponse> {
    const target = await this.findUserOrThrow(username);
    await this.prisma.follow.deleteMany({
      where: { followerId: viewerId, followingId: target.id },
    });
    await this.prisma.activityEvent.deleteMany({
      where: { actorId: viewerId, type: 'FOLLOWED', targetUserId: target.id },
    });
    return this.followState(viewerId, target.id);
  }

  private async followState(viewerId: string, targetId: string): Promise<FollowStateResponse> {
    const [existing, followerCount] = await Promise.all([
      this.prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: viewerId, followingId: targetId } },
      }),
      this.prisma.follow.count({ where: { followingId: targetId } }),
    ]);
    return { following: !!existing, followerCount };
  }

  async listFollowers(
    username: string,
    viewerId: string | undefined,
    cursor?: string,
    limit = 30,
  ): Promise<MemberListResponse> {
    const target = await this.findUserOrThrow(username);
    const skip = cursor ? Number(cursor) : 0;
    const rows = await this.prisma.follow.findMany({
      where: { followingId: target.id, follower: await this.notBlockedFilter(viewerId) },
      include: { follower: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip,
    });
    return {
      members: await this.toMemberSummaries(rows.map((r) => r.follower), viewerId),
      nextCursor: rows.length >= limit ? String(skip + limit) : null,
    };
  }

  async listFollowing(
    username: string,
    viewerId: string | undefined,
    cursor?: string,
    limit = 30,
  ): Promise<MemberListResponse> {
    const target = await this.findUserOrThrow(username);
    const skip = cursor ? Number(cursor) : 0;
    const rows = await this.prisma.follow.findMany({
      where: { followerId: target.id, following: await this.notBlockedFilter(viewerId) },
      include: { following: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip,
    });
    return {
      members: await this.toMemberSummaries(rows.map((r) => r.following), viewerId),
      nextCursor: rows.length >= limit ? String(skip + limit) : null,
    };
  }

  /** The Members browse page. Private profiles are excluded for other viewers. */
  async listMembers(
    viewerId: string | undefined,
    query: MemberListQuery,
  ): Promise<MemberListResponse> {
    const skip = query.cursor ? Number(query.cursor) : 0;
    const blocked = await this.blockedIds(viewerId);

    const where: Record<string, unknown> = {
      ...(blocked.length ? { id: { notIn: blocked } } : {}),
      // A PRIVATE profile shouldn't be discoverable in a member directory,
      // though the owner still sees their own row.
      ...(viewerId
        ? { OR: [{ profileVisibility: { not: 'PRIVATE' } }, { id: viewerId }] }
        : { profileVisibility: { not: 'PRIVATE' } }),
      ...(query.q
        ? { username: { contains: query.q } }
        : {}),
    };

    const users = await this.prisma.user.findMany({
      where,
      orderBy:
        query.sort === 'RECENT'
          ? { createdAt: 'desc' }
          : query.sort === 'ACTIVE'
            ? { updatedAt: 'desc' }
            : { followedBy: { _count: 'desc' } },
      take: query.limit,
      skip,
    });

    return {
      members: await this.toMemberSummaries(users, viewerId),
      nextCursor: users.length >= query.limit ? String(skip + query.limit) : null,
    };
  }

  // -- blocking ----------------------------------------------------------------

  async block(viewerId: string, username: string): Promise<void> {
    const target = await this.findUserOrThrow(username);
    if (target.id === viewerId) throw new BadRequestException('You cannot block yourself');
    try {
      await this.prisma.userBlock.create({
        data: { blockerId: viewerId, blockedId: target.id },
      });
    } catch (err) {
      if (!isUniqueConstraintError(err)) throw err;
    }
    // Blocking severs any existing follow relationship in both directions, and
    // retracts the "followed" feed events with it — otherwise a dissolved
    // relationship keeps advertising itself in everyone else's feed.
    await this.prisma.$transaction([
      this.prisma.follow.deleteMany({
        where: {
          OR: [
            { followerId: viewerId, followingId: target.id },
            { followerId: target.id, followingId: viewerId },
          ],
        },
      }),
      this.prisma.activityEvent.deleteMany({
        where: {
          type: 'FOLLOWED',
          OR: [
            { actorId: viewerId, targetUserId: target.id },
            { actorId: target.id, targetUserId: viewerId },
          ],
        },
      }),
    ]);
  }

  async unblock(viewerId: string, username: string): Promise<void> {
    const target = await this.findUserOrThrow(username);
    await this.prisma.userBlock.deleteMany({
      where: { blockerId: viewerId, blockedId: target.id },
    });
  }

  async listBlocked(viewerId: string): Promise<MemberListResponse> {
    const rows = await this.prisma.userBlock.findMany({
      where: { blockerId: viewerId },
      include: { blocked: true },
      orderBy: { createdAt: 'desc' },
    });
    return {
      members: await this.toMemberSummaries(rows.map((r) => r.blocked), viewerId),
      nextCursor: null,
    };
  }

  /** Ids the viewer has blocked, or who have blocked the viewer — hidden both ways. */
  async blockedIds(viewerId: string | undefined): Promise<string[]> {
    if (!viewerId) return [];
    const rows = await this.prisma.userBlock.findMany({
      where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
      select: { blockerId: true, blockedId: true },
    });
    const ids = new Set<string>();
    for (const r of rows) {
      ids.add(r.blockerId === viewerId ? r.blockedId : r.blockerId);
    }
    return [...ids];
  }

  private async eitherBlocks(a: string, b: string): Promise<boolean> {
    const row = await this.prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: a, blockedId: b },
          { blockerId: b, blockedId: a },
        ],
      },
    });
    return !!row;
  }

  private async notBlockedFilter(
    viewerId: string | undefined,
  ): Promise<{ id?: { notIn: string[] } }> {
    const blocked = await this.blockedIds(viewerId);
    return blocked.length ? { id: { notIn: blocked } } : {};
  }

  // -- activity feed -----------------------------------------------------------

  async getFeed(
    viewerId: string,
    query: ActivityFeedQuery,
  ): Promise<ActivityFeedResponse> {
    const skip = query.cursor ? Number(query.cursor) : 0;
    const blocked = await this.blockedIds(viewerId);

    let actorFilter: Record<string, unknown>;
    if (query.scope === 'FOLLOWING') {
      const following = await this.prisma.follow.findMany({
        where: { followerId: viewerId },
        select: { followingId: true },
      });
      const ids = following.map((f) => f.followingId).filter((id) => !blocked.includes(id));
      if (ids.length === 0) return { items: [], nextCursor: null };
      actorFilter = { actorId: { in: ids } };
    } else {
      actorFilter = {
        // Instance-wide: the viewer is part of the instance, so their own
        // activity belongs here too. Blocked members never appear.
        actorId: { notIn: blocked },
        actor: { profileVisibility: { not: 'PRIVATE' } },
      };
    }

    // Over-fetch: grouping collapses rows, so a raw page of `limit` would often
    // render short.
    const raw = await this.prisma.activityEvent.findMany({
      where: {
        ...actorFilter,
        // Callers can narrow to the event kinds they actually render; the
        // discovery sidebar asks for opinions only (rated / reviewed).
        ...(query.types?.length ? { type: { in: query.types } } : {}),
      },
      include: { actor: true, media: true },
      orderBy: { createdAt: 'desc' },
      take: query.limit * 3,
      skip,
    });

    const targetUserIds = [...new Set(raw.map((e) => e.targetUserId).filter((v): v is string => !!v))];
    const targetUsers = targetUserIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: targetUserIds } },
          select: { id: true, username: true, displayName: true },
        })
      : [];
    const targetById = new Map(targetUsers.map((u) => [u.id, u]));

    // Attach the actor's rating for rating/review events so the feed can show stars.
    const ratingKeys = raw
      .filter((e) => e.mediaItemId && (e.type === 'RATED' || e.type === 'REVIEWED'))
      .map((e) => ({ userId: e.actorId, mediaItemId: e.mediaItemId as string }));
    const ratings = ratingKeys.length
      ? await this.prisma.rating.findMany({ where: { OR: ratingKeys } })
      : [];
    const ratingByKey = new Map(ratings.map((r) => [`${r.userId}:${r.mediaItemId}`, r.value]));

    const items: ActivityItem[] = [];
    for (const event of raw) {
      const prev = items[items.length - 1];
      const media = event.media ? this.toSummary(event.media) : null;

      // Fold into the previous row when it's the same actor doing the same kind
      // of thing within the window.
      if (
        prev &&
        media &&
        prev.actor.id === event.actorId &&
        prev.type === event.type &&
        prev.media !== null &&
        new Date(prev.createdAt).getTime() - event.createdAt.getTime() < GROUP_WINDOW_MS
      ) {
        prev.groupedMedia.push(media);
        continue;
      }

      if (items.length >= query.limit) break;

      const target = event.targetUserId ? targetById.get(event.targetUserId) : undefined;
      items.push({
        id: event.id,
        type: ActivityType.catch('RATED').parse(event.type),
        actor: {
          id: event.actor.id,
          username: event.actor.username,
          displayName: event.actor.displayName,
          avatarUrl: event.actor.avatarUrl,
        },
        media,
        ratingValue: event.mediaItemId
          ? (ratingByKey.get(`${event.actorId}:${event.mediaItemId}`) ?? null)
          : null,
        reviewId: event.reviewId,
        listId: event.listId,
        targetUser: target
          ? { id: target.id, username: target.username, displayName: target.displayName }
          : null,
        createdAt: event.createdAt.toISOString(),
        groupedMedia: [],
      });
    }

    return {
      items,
      nextCursor: raw.length >= query.limit * 3 ? String(skip + raw.length) : null,
    };
  }

  // -- helpers -----------------------------------------------------------------

  private async findUserOrThrow(username: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private toSummary(media: MediaItem): MediaSummary {
    return {
      id: media.id,
      type: MediaType.catch('MOVIE').parse(media.type),
      title: media.title,
      year: media.releaseDate ? Number(media.releaseDate.slice(0, 4)) || null : null,
      posterUrl: this.artwork.toProxyUrl(media.posterPath),
    };
  }

  private async toMemberSummaries(
    users: User[],
    viewerId: string | undefined,
  ): Promise<MemberSummary[]> {
    if (users.length === 0) return [];
    const ids = users.map((u) => u.id);

    const [followerCounts, filmCounts, viewerFollows, followsViewer] = await Promise.all([
      this.prisma.follow.groupBy({
        by: ['followingId'],
        where: { followingId: { in: ids } },
        _count: { followingId: true },
      }),
      this.prisma.rating.groupBy({
        by: ['userId'],
        where: { userId: { in: ids } },
        _count: { userId: true },
      }),
      viewerId
        ? this.prisma.follow.findMany({
            where: { followerId: viewerId, followingId: { in: ids } },
            select: { followingId: true },
          })
        : Promise.resolve([]),
      viewerId
        ? this.prisma.follow.findMany({
            where: { followingId: viewerId, followerId: { in: ids } },
            select: { followerId: true },
          })
        : Promise.resolve([]),
    ]);

    const followerByUser = new Map(followerCounts.map((f) => [f.followingId, f._count.followingId]));
    const filmsByUser = new Map(filmCounts.map((f) => [f.userId, f._count.userId]));
    const followedSet = new Set(viewerFollows.map((f) => f.followingId));
    const followsBackSet = new Set(followsViewer.map((f) => f.followerId));

    return users.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      bio: u.bio,
      isFollowedByViewer: viewerId ? followedSet.has(u.id) : null,
      followsViewer: viewerId ? followsBackSet.has(u.id) : null,
      isSelf: viewerId === u.id,
      followerCount: followerByUser.get(u.id) ?? 0,
      filmCount: filmsByUser.get(u.id) ?? 0,
    }));
  }
}

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002';
}
