import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SocialService } from './social.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ArtworkService } from '../artwork/artwork.service';
import { ActivityService } from './activity.service';
import { visibleUserWhere } from '../common/visibility';

const fakeArtwork = { toProxyUrl: (u: string | null) => u } as unknown as ArtworkService;
const fakeActivity = {
  record: jest.fn().mockResolvedValue(undefined),
  recordReplacing: jest.fn().mockResolvedValue(undefined),
} as unknown as ActivityService;

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(1),
    },
    list: { findMany: jest.fn().mockResolvedValue([]) },
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
      count: jest.fn().mockResolvedValue(0),
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

  it('an EVERYONE feed only shows actors the viewer may see', async () => {
    const prisma = makePrisma();
    await makeService(prisma).getFeed('viewer-1', { scope: 'EVERYONE', limit: 25 } as never);
    const args = (prisma.activityEvent.findMany as jest.Mock).mock.calls[0][0];
    expect(args.where.actor).toEqual(visibleUserWhere('viewer-1'));
    // passwordHash/email must never be loaded for the response.
    expect(args.include.actor).toEqual({
      select: { id: true, username: true, displayName: true, avatarUrl: true },
    });
  });

  it('a FOLLOWING feed applies the same visibility (no PRIVATE actors even when followed)', async () => {
    const prisma = makePrisma();
    (prisma.follow.findMany as jest.Mock).mockResolvedValue([{ followingId: 'private-friend' }]);
    await makeService(prisma).getFeed('viewer-1', { scope: 'FOLLOWING', limit: 25 } as never);
    const where = (prisma.activityEvent.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.actor).toEqual(visibleUserWhere('viewer-1'));
  });

  it('visibleUserWhere: own content always; others PUBLIC or followed FOLLOWERS, never PRIVATE, never across a block', () => {
    expect(visibleUserWhere(undefined)).toEqual({ profileVisibility: 'PUBLIC' });
    const w = visibleUserWhere('v') as { OR: Record<string, unknown>[] };
    expect(w.OR[0]).toEqual({ id: 'v' });
    expect(w.OR[1]).toEqual({
      OR: [
        { profileVisibility: 'PUBLIC' },
        { profileVisibility: 'FOLLOWERS', followedBy: { some: { followerId: 'v' } } },
      ],
      blocking: { none: { blockedId: 'v' } },
      blockedBy: { none: { blockerId: 'v' } },
    });
  });

  it('the next cursor starts right after the last raw row actually consumed', async () => {
    const prisma = makePrisma();
    const actor = { id: 'a', username: 'a', displayName: null, avatarUrl: null };
    const media = { id: 'm', type: 'MOVIE', title: 'M', releaseDate: null, posterPath: null };
    // limit 1 -> over-fetch 3 rows; three different types, so row 2 can't fold
    // into row 1 and the page stops after consuming one raw row.
    const row = (id: string, type: string, hour: number) => ({
      id, actorId: 'a', type, mediaItemId: 'm', reviewId: null, listId: null, targetUserId: null,
      createdAt: new Date(`2026-01-01T${String(hour).padStart(2, '0')}:00:00Z`), actor, media,
    });
    (prisma.activityEvent.findMany as jest.Mock).mockResolvedValue([
      row('e1', 'RATED', 12),
      row('e2', 'WATCHED', 11),
      row('e3', 'FAVORITED', 10),
    ]);
    const feed = await makeService(prisma).getFeed('viewer-1', {
      scope: 'EVERYONE',
      limit: 1,
      cursor: '6',
    } as never);
    expect(feed.items.map((i) => i.id)).toEqual(['e1']);
    expect(feed.nextCursor).toBe('7');
  });

  it('list events carry the list title', async () => {
    const prisma = makePrisma();
    (prisma.activityEvent.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'e1', actorId: 'a', type: 'LIST_UPDATED', mediaItemId: null, reviewId: null,
        listId: 'list-1', targetUserId: null, createdAt: new Date(),
        actor: { id: 'a', username: 'a', displayName: null, avatarUrl: null }, media: null,
      },
    ]);
    (prisma.list.findMany as jest.Mock).mockResolvedValue([{ id: 'list-1', title: 'Best of 2026' }]);
    const feed = await makeService(prisma).getFeed('viewer-1', { scope: 'EVERYONE', limit: 25 } as never);
    expect(feed.items[0]).toMatchObject({ listId: 'list-1', listTitle: 'Best of 2026' });
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

describe('SocialService follower lists', () => {
  it('404 across a block, empty when the profile is hidden from the viewer', async () => {
    const blocked = makePrisma();
    (blocked.user.findUnique as jest.Mock).mockResolvedValue(OWNER);
    (blocked.userBlock.count as jest.Mock).mockResolvedValue(1);
    await expect(makeService(blocked).listFollowers('owner', 'viewer-1')).rejects.toThrow(NotFoundException);
    await expect(makeService(blocked).listFollowing('owner', 'viewer-1')).rejects.toThrow(NotFoundException);

    const hidden = makePrisma();
    (hidden.user.findUnique as jest.Mock).mockResolvedValue(OWNER);
    (hidden.user.count as jest.Mock).mockResolvedValue(0);
    expect(await makeService(hidden).listFollowers('owner', 'viewer-1')).toEqual({ members: [], nextCursor: null });
    expect(await makeService(hidden).listFollowing('owner', undefined)).toEqual({ members: [], nextCursor: null });
    expect(hidden.follow.findMany).not.toHaveBeenCalled();
  });
});

describe('ActivityService.recordReplacing', () => {
  it('keys the replacement on the list too, so editing list B leaves list A\'s event alone', async () => {
    const prisma = makePrisma({
      activityEvent: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }), create: jest.fn() },
    });
    await new ActivityService(prisma).recordReplacing({ actorId: 'u', type: 'LIST_UPDATED', listId: 'list-b' });
    expect(prisma.activityEvent.deleteMany).toHaveBeenCalledWith({
      where: { actorId: 'u', type: 'LIST_UPDATED', mediaItemId: null, listId: 'list-b' },
    });
  });

  it('media events still replace by media (list key null)', async () => {
    const prisma = makePrisma({
      activityEvent: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }), create: jest.fn() },
    });
    await new ActivityService(prisma).recordReplacing({ actorId: 'u', type: 'RATED', mediaItemId: 'm1' });
    expect(prisma.activityEvent.deleteMany).toHaveBeenCalledWith({
      where: { actorId: 'u', type: 'RATED', mediaItemId: 'm1', listId: null },
    });
  });
});

describe('SocialService profile activity & member search', () => {
  it('a member\'s activity is narrowed to them and still visibility-filtered', async () => {
    const prisma = makePrisma();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(OWNER);
    await makeService(prisma).getUserActivity('owner', 'viewer-1', { limit: 25 } as never);
    const where = (prisma.activityEvent.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.actorId).toEqual({ in: ['owner-1'] });
    expect(where.actor).toEqual(visibleUserWhere('viewer-1'));
  });

  it('a hidden profile yields no activity; a block is a 404', async () => {
    const hidden = makePrisma();
    (hidden.user.findUnique as jest.Mock).mockResolvedValue(OWNER);
    (hidden.user.count as jest.Mock).mockResolvedValue(0); // canSeeUser -> false
    await expect(
      makeService(hidden).getUserActivity('owner', undefined, { limit: 25 } as never),
    ).resolves.toEqual({ items: [], nextCursor: null });
    expect(hidden.activityEvent.findMany).not.toHaveBeenCalled();

    const blocked = makePrisma();
    (blocked.user.findUnique as jest.Mock).mockResolvedValue(OWNER);
    (blocked.userBlock.count as jest.Mock).mockResolvedValue(1);
    await expect(
      makeService(blocked).getUserActivity('owner', 'viewer-1', { limit: 25 } as never),
    ).rejects.toThrow(NotFoundException);
  });

  it('member search matches username or display name, never PRIVATE profiles or blocked members', async () => {
    const prisma = makePrisma();
    (prisma.userBlock.findMany as jest.Mock).mockResolvedValue([
      { blockerId: 'viewer-1', blockedId: 'blocked-user' },
    ]);
    await makeService(prisma).listMembers('viewer-1', { q: 'ann', sort: 'POPULAR', limit: 24 } as never);
    const where = (prisma.user.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.id).toEqual({ notIn: ['blocked-user'] });
    expect(where.OR).toEqual([{ profileVisibility: { not: 'PRIVATE' } }, { id: 'viewer-1' }]);
    expect(where.AND).toEqual([
      { OR: [{ username: { contains: 'ann' } }, { displayName: { contains: 'ann' } }] },
    ]);
  });
});
