import { BadRequestException } from '@nestjs/common';
import { SocialService } from './social.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ArtworkService } from '../artwork/artwork.service';
import type { ActivityService } from './activity.service';

const fakeArtwork = { toProxyUrl: (u: string | null) => u } as unknown as ArtworkService;
const fakeActivity = {
  record: jest.fn().mockResolvedValue(undefined),
  recordReplacing: jest.fn().mockResolvedValue(undefined),
} as unknown as ActivityService;

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    user: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    follow: {
      create: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    userBlock: {
      create: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    activityEvent: {
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    rating: { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) },
    ...overrides,
  } as unknown as PrismaService;
}

function makeService(prisma: PrismaService): SocialService {
  return new SocialService(prisma, fakeArtwork, fakeActivity);
}

const OWNER = { id: 'owner-1', username: 'owner' };

describe('SocialService follows', () => {
  it('refuses a self-follow', async () => {
    const prisma = makePrisma();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(OWNER);
    await expect(makeService(prisma).follow('owner-1', 'owner')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('refuses to follow a member either side has blocked', async () => {
    const prisma = makePrisma();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(OWNER);
    (prisma.userBlock.findFirst as jest.Mock).mockResolvedValue({ id: 'b1' });
    await expect(makeService(prisma).follow('viewer-1', 'owner')).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.follow.create).not.toHaveBeenCalled();
  });

  it('treats a repeat follow as a no-op rather than an error', async () => {
    const prisma = makePrisma();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(OWNER);
    (prisma.follow.create as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('dup'), { code: 'P2002' }),
    );
    await expect(makeService(prisma).follow('viewer-1', 'owner')).resolves.toEqual(
      expect.objectContaining({ following: false }),
    );
  });

  it('blocking severs follows and retracts the follow events in both directions', async () => {
    const prisma = makePrisma({
      $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(OWNER);
    await makeService(prisma).block('viewer-1', 'owner');

    expect(prisma.follow.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { followerId: 'viewer-1', followingId: 'owner-1' },
          { followerId: 'owner-1', followingId: 'viewer-1' },
        ],
      },
    });
    // A dissolved relationship must not keep advertising itself in other feeds.
    expect(prisma.activityEvent.deleteMany).toHaveBeenCalledWith({
      where: {
        type: 'FOLLOWED',
        OR: [
          { actorId: 'viewer-1', targetUserId: 'owner-1' },
          { actorId: 'owner-1', targetUserId: 'viewer-1' },
        ],
      },
    });
  });

  it('refuses a self-block', async () => {
    const prisma = makePrisma();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(OWNER);
    await expect(makeService(prisma).block('owner-1', 'owner')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('blockedIds hides the pair in both directions', async () => {
    const prisma = makePrisma();
    (prisma.userBlock.findMany as jest.Mock).mockResolvedValue([
      { blockerId: 'viewer-1', blockedId: 'a' }, // viewer blocked a
      { blockerId: 'b', blockedId: 'viewer-1' }, // b blocked viewer
    ]);
    const ids = await makeService(prisma).blockedIds('viewer-1');
    expect(ids.sort()).toEqual(['a', 'b']);
  });
});

describe('SocialService activity feed', () => {
  it('returns nothing for a FOLLOWING feed when the viewer follows no one', async () => {
    const prisma = makePrisma();
    const feed = await makeService(prisma).getFeed('viewer-1', {
      scope: 'FOLLOWING',
      limit: 25,
    } as never);
    expect(feed.items).toEqual([]);
    // Should short-circuit without querying events at all.
    expect(prisma.activityEvent.findMany).not.toHaveBeenCalled();
  });

  it('excludes blocked members from a FOLLOWING feed even if still followed', async () => {
    const prisma = makePrisma();
    (prisma.userBlock.findMany as jest.Mock).mockResolvedValue([
      { blockerId: 'viewer-1', blockedId: 'blocked-user' },
    ]);
    (prisma.follow.findMany as jest.Mock).mockResolvedValue([
      { followingId: 'blocked-user' },
      { followingId: 'ok-user' },
    ]);
    await makeService(prisma).getFeed('viewer-1', { scope: 'FOLLOWING', limit: 25 } as never);
    const where = (prisma.activityEvent.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.actorId.in).toEqual(['ok-user']);
  });

  it('an EVERYONE feed excludes private profiles and blocked members, but includes the viewer', async () => {
    const prisma = makePrisma();
    (prisma.userBlock.findMany as jest.Mock).mockResolvedValue([
      { blockerId: 'viewer-1', blockedId: 'blocked-user' },
    ]);
    await makeService(prisma).getFeed('viewer-1', { scope: 'EVERYONE', limit: 25 } as never);
    const where = (prisma.activityEvent.findMany as jest.Mock).mock.calls[0][0].where;
    // The viewer is part of the instance, so their own activity belongs in
    // the instance-wide feed.
    expect(where.actorId.notIn).toEqual(['blocked-user']);
    expect(where.actor).toEqual({ profileVisibility: { not: 'PRIVATE' } });
  });

  it('groups same-actor same-type events inside the window into one row', async () => {
    const prisma = makePrisma();
    (prisma.follow.findMany as jest.Mock).mockResolvedValue([{ followingId: 'friend' }]);
    const actor = { id: 'friend', username: 'friend', displayName: null, avatarUrl: null };
    const media = (id: string) => ({
      id,
      type: 'MOVIE',
      title: `Film ${id}`,
      releaseDate: '2020-01-01',
      posterPath: null,
    });
    (prisma.activityEvent.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'e1',
        actorId: 'friend',
        type: 'RATED',
        mediaItemId: 'm1',
        reviewId: null,
        listId: null,
        targetUserId: null,
        createdAt: new Date('2026-01-01T12:00:00Z'),
        actor,
        media: media('m1'),
      },
      {
        id: 'e2',
        actorId: 'friend',
        type: 'RATED',
        mediaItemId: 'm2',
        reviewId: null,
        listId: null,
        targetUserId: null,
        createdAt: new Date('2026-01-01T11:45:00Z'),
        actor,
        media: media('m2'),
      },
    ]);

    const feed = await makeService(prisma).getFeed('viewer-1', {
      scope: 'FOLLOWING',
      limit: 25,
    } as never);

    expect(feed.items).toHaveLength(1);
    expect(feed.items[0]?.groupedMedia).toHaveLength(1);
    expect(feed.items[0]?.groupedMedia[0]?.id).toBe('m2');
  });

  it('keeps events outside the grouping window as separate rows', async () => {
    const prisma = makePrisma();
    (prisma.follow.findMany as jest.Mock).mockResolvedValue([{ followingId: 'friend' }]);
    const actor = { id: 'friend', username: 'friend', displayName: null, avatarUrl: null };
    const media = (id: string) => ({
      id,
      type: 'MOVIE',
      title: `Film ${id}`,
      releaseDate: '2020-01-01',
      posterPath: null,
    });
    (prisma.activityEvent.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'e1',
        actorId: 'friend',
        type: 'RATED',
        mediaItemId: 'm1',
        reviewId: null,
        listId: null,
        targetUserId: null,
        createdAt: new Date('2026-01-02T12:00:00Z'),
        actor,
        media: media('m1'),
      },
      {
        id: 'e2',
        actorId: 'friend',
        type: 'RATED',
        mediaItemId: 'm2',
        reviewId: null,
        listId: null,
        targetUserId: null,
        // A day earlier — well outside the one-hour grouping window.
        createdAt: new Date('2026-01-01T12:00:00Z'),
        actor,
        media: media('m2'),
      },
    ]);

    const feed = await makeService(prisma).getFeed('viewer-1', {
      scope: 'FOLLOWING',
      limit: 25,
    } as never);
    expect(feed.items).toHaveLength(2);
  });
});
