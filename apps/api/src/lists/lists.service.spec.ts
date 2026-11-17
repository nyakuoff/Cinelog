import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ListsService } from './lists.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ArtworkService } from '../artwork/artwork.service';
import type { ActivityService } from '../social/activity.service';
import { visibleUserWhere } from '../common/visibility';

const fakeArtwork = { toProxyUrl: (u: string | null) => u } as unknown as ArtworkService;
const fakeActivity = {
  record: jest.fn().mockResolvedValue(undefined),
  recordReplacing: jest.fn().mockResolvedValue(undefined),
} as unknown as ActivityService;

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    list: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    listItem: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    listLike: { create: jest.fn(), deleteMany: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    listComment: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    mediaItem: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    // canSeeUser / isBlockedBetween: default to "visible, not blocked".
    user: { findUnique: jest.fn(), count: jest.fn().mockResolvedValue(1) },
    userBlock: { count: jest.fn().mockResolvedValue(0) },
    activityEvent: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
    ...overrides,
  } as unknown as PrismaService;
}

function makeService(prisma: PrismaService): ListsService {
  return new ListsService(prisma, fakeArtwork, fakeActivity);
}

const OWNED = { id: 'list-1', userId: 'owner-1', isPublic: true, title: 'My list' };

describe('ListsService permissions', () => {
  it('only the owner can edit, delete, or reorder a list', async () => {
    const prisma = makePrisma();
    (prisma.list.findUnique as jest.Mock).mockResolvedValue(OWNED);
    const svc = makeService(prisma);

    await expect(svc.update('someone-else', 'list-1', { title: 'x' })).rejects.toThrow(
      ForbiddenException,
    );
    await expect(svc.remove('someone-else', 'list-1')).rejects.toThrow(ForbiddenException);
    await expect(
      svc.reorder('someone-else', 'list-1', { entryIds: ['a'] }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('a private list reads as not-found to anyone but its owner', async () => {
    const prisma = makePrisma();
    (prisma.list.findUnique as jest.Mock).mockResolvedValue({ ...OWNED, isPublic: false });
    const svc = makeService(prisma);
    // 404 rather than 403 so a private list's existence isn't confirmed.
    await expect(svc.getDetail('list-1', 'someone-else')).rejects.toThrow(NotFoundException);
    await expect(svc.getDetail('list-1', undefined)).rejects.toThrow(NotFoundException);
  });

  it('a public list on a profile hidden from the viewer (privacy or block) is not found', async () => {
    const prisma = makePrisma();
    (prisma.list.findUnique as jest.Mock).mockResolvedValue(OWNED);
    (prisma.user.count as jest.Mock).mockResolvedValue(0);
    const svc = makeService(prisma);
    await expect(svc.getDetail('list-1', 'someone-else')).rejects.toThrow(NotFoundException);
    await expect(svc.like('someone-else', 'list-1')).rejects.toThrow(NotFoundException);
    await expect(svc.listComments('list-1', 'someone-else')).rejects.toThrow(NotFoundException);
    await expect(svc.addComment('someone-else', 'list-1', { body: 'hi' })).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.listLike.create).not.toHaveBeenCalled();
    expect(prisma.listComment.create).not.toHaveBeenCalled();
  });

  it("a member's lists page: 404 across a block, empty when their profile is hidden", async () => {
    const blocked = makePrisma();
    (blocked.user.findUnique as jest.Mock).mockResolvedValue({ id: 'owner-1' });
    (blocked.userBlock.count as jest.Mock).mockResolvedValue(1);
    await expect(makeService(blocked).listByOwner('owner', 'viewer-1')).rejects.toThrow(
      NotFoundException,
    );

    const hidden = makePrisma();
    (hidden.user.findUnique as jest.Mock).mockResolvedValue({ id: 'owner-1' });
    (hidden.user.count as jest.Mock).mockResolvedValue(0);
    expect(await makeService(hidden).listByOwner('owner', 'viewer-1')).toEqual({
      lists: [],
      nextCursor: null,
    });
    expect(hidden.list.findMany).not.toHaveBeenCalled();
  });

  it("a member's lists flag which ones contain containsMediaId", async () => {
    const prisma = makePrisma();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'owner-1' });
    const svc = makeService(prisma);
    (svc as unknown as { toSummaries: jest.Mock }).toSummaries = jest
      .fn()
      .mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    (prisma.list.findMany as jest.Mock).mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    (prisma.listItem.findMany as jest.Mock).mockResolvedValue([{ listId: 'b' }]);
    const res = await svc.listByOwner('owner', 'owner-1', 'm1');
    expect(res.lists.map((l) => l.containsMedia)).toEqual([false, true]);
  });

  it('browse and lists-containing-a-title filter owners by visibility', async () => {
    const prisma = makePrisma();
    const svc = makeService(prisma);
    await svc.browse('viewer-1', { sort: 'RECENT', limit: 24 } as never, 'media-9');
    const where = (prisma.list.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.isPublic).toBe(true);
    expect(where.user).toEqual(visibleUserWhere('viewer-1'));
    expect(where.items).toEqual({ some: { mediaItemId: 'media-9' } });
  });

  it('only the comment author can delete their comment', async () => {
    const prisma = makePrisma();
    (prisma.listComment.findUnique as jest.Mock).mockResolvedValue({
      id: 'c1',
      listId: 'list-1',
      userId: 'commenter-1',
    });
    await expect(makeService(prisma).deleteComment('someone-else', 'c1')).rejects.toThrow(
      ForbiddenException,
    );
  });
});

describe('ListsService entries', () => {
  it('rejects a duplicate title with a clear message', async () => {
    const prisma = makePrisma();
    (prisma.list.findUnique as jest.Mock).mockResolvedValue(OWNED);
    (prisma.mediaItem.findUnique as jest.Mock).mockResolvedValue({ id: 'm1' });
    (prisma.listItem.create as jest.Mock).mockRejectedValue(
      Object.assign(new Error('dup'), { code: 'P2002' }),
    );

    await expect(
      makeService(prisma).addItem('owner-1', 'list-1', { mediaId: 'm1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a reorder that does not cover every entry exactly once', async () => {
    const prisma = makePrisma();
    (prisma.list.findUnique as jest.Mock).mockResolvedValue(OWNED);
    (prisma.listItem.findMany as jest.Mock).mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    const svc = makeService(prisma);

    // Missing an entry.
    await expect(svc.reorder('owner-1', 'list-1', { entryIds: ['a'] })).rejects.toThrow(
      BadRequestException,
    );
    // Contains an id from another list.
    await expect(
      svc.reorder('owner-1', 'list-1', { entryIds: ['a', 'zzz'] }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('writes a full reorder as sequential positions in one transaction', async () => {
    const prisma = makePrisma();
    (prisma.list.findUnique as jest.Mock).mockResolvedValue(OWNED);
    (prisma.listItem.findMany as jest.Mock).mockResolvedValue([
      { id: 'a' },
      { id: 'b' },
      { id: 'c' },
    ]);
    const svc = makeService(prisma);
    // getDetail runs after the write; give it a shaped row to return.
    (prisma.list.findUnique as jest.Mock).mockResolvedValue({
      ...OWNED,
      user: { id: 'owner-1', username: 'owner', displayName: null, avatarUrl: null },
      _count: { items: 3, likes: 0, comments: 0 },
      items: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      description: null,
    });

    await svc.reorder('owner-1', 'list-1', { entryIds: ['c', 'a', 'b'] });

    expect(prisma.listItem.update).toHaveBeenCalledWith({
      where: { id: 'c' },
      data: { position: 1 },
    });
    expect(prisma.listItem.update).toHaveBeenCalledWith({
      where: { id: 'a' },
      data: { position: 2 },
    });
    expect(prisma.listItem.update).toHaveBeenCalledWith({
      where: { id: 'b' },
      data: { position: 3 },
    });
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('making a list private retracts its activity events', async () => {
    const prisma = makePrisma();
    (prisma.list.findUnique as jest.Mock).mockResolvedValue({
      ...OWNED,
      user: { id: 'owner-1', username: 'owner', displayName: null, avatarUrl: null },
      _count: { items: 0, likes: 0, comments: 0 },
      items: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      description: null,
    });
    (prisma.list.update as jest.Mock).mockResolvedValue({ ...OWNED, isPublic: false });

    await makeService(prisma).update('owner-1', 'list-1', { isPublic: false });
    expect(prisma.activityEvent.deleteMany).toHaveBeenCalledWith({ where: { listId: 'list-1' } });
  });
});

describe('ListsService search, likes, viewer progress', () => {
  it('list search only covers public lists of visible owners', async () => {
    const prisma = makePrisma();
    await makeService(prisma).browse('viewer-1', { sort: 'POPULAR', limit: 24 } as never, undefined, { q: 'noir' });
    const where = (prisma.list.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.isPublic).toBe(true);
    expect(where.user).toEqual(visibleUserWhere('viewer-1'));
    expect(where.OR).toEqual([{ title: { contains: 'noir' } }, { description: { contains: 'noir' } }]);
  });

  it('liked lists are limited to ones the viewer could open', async () => {
    const prisma = makePrisma();
    await makeService(prisma).listLikedBy('owner-1', 'viewer-1', undefined, 30);
    await makeService(prisma).listLikedBy('owner-1', undefined, undefined, 30);
    const [signedIn, anon] = (prisma.listLike.findMany as jest.Mock).mock.calls.map((c) => c[0].where);
    expect(signedIn).toEqual({
      userId: 'owner-1',
      list: { OR: [{ isPublic: true, user: visibleUserWhere('viewer-1') }, { userId: 'viewer-1' }] },
    });
    expect(anon.list).toEqual({ OR: [{ isPublic: true, user: { profileVisibility: 'PUBLIC' } }] });
  });

  it('list detail marks which entries the signed-in viewer has watched', async () => {
    const prisma = makePrisma();
    const media = (id: string) => ({ id, type: 'MOVIE', title: id, releaseDate: null, posterPath: null });
    (prisma.list.findUnique as jest.Mock).mockResolvedValue({
      ...OWNED,
      isRanked: true,
      user: { id: 'owner-1', username: 'owner', displayName: null, avatarUrl: null },
      _count: { items: 2, likes: 0, comments: 0 },
      items: [
        { id: 'e1', position: 1, note: null, mediaItemId: 'm1', media: media('m1') },
        { id: 'e2', position: 2, note: null, mediaItemId: 'm2', media: media('m2') },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      description: null,
    });
    (prisma.mediaItem as unknown as { findMany: jest.Mock }).findMany.mockResolvedValue([{ id: 'm2' }]);
    const detail = await makeService(prisma).getDetail('list-1', 'viewer-1');
    expect(detail.viewerWatchedCount).toBe(1);
    expect(detail.entries.map((e) => e.viewerWatched)).toEqual([false, true]);
    expect(detail.isRanked).toBe(true);

    const anon = await makeService(prisma).getDetail('list-1', undefined);
    expect(anon.viewerWatchedCount).toBeUndefined();
  });
});
