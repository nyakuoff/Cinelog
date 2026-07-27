import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ListsService } from './lists.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ArtworkService } from '../artwork/artwork.service';
import type { ActivityService } from '../social/activity.service';
import type { SocialService } from '../social/social.service';

const fakeArtwork = { toProxyUrl: (u: string | null) => u } as unknown as ArtworkService;
const fakeActivity = {
  record: jest.fn().mockResolvedValue(undefined),
  recordReplacing: jest.fn().mockResolvedValue(undefined),
} as unknown as ActivityService;
const fakeSocial = { blockedIds: jest.fn().mockResolvedValue([]) } as unknown as SocialService;

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
    mediaItem: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    activityEvent: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
    ...overrides,
  } as unknown as PrismaService;
}

function makeService(prisma: PrismaService): ListsService {
  return new ListsService(prisma, fakeArtwork, fakeActivity, fakeSocial);
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
