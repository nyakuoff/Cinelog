import { HomeService } from './home.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ArtworkService } from '../artwork/artwork.service';
import type { ReviewsService } from '../reviews/reviews.service';
import type { ListsService } from '../lists/lists.service';
import { visibleUserWhere } from '../common/visibility';

const fakeArtwork = { toProxyUrl: (u: string | null) => u } as unknown as ArtworkService;

function setup(following: string[], friendLists: unknown[] = []) {
  const prisma = {
    follow: { findMany: jest.fn().mockResolvedValue(following.map((followingId) => ({ followingId }))) },
    activityEvent: { findMany: jest.fn().mockResolvedValue([]) },
    review: { findMany: jest.fn().mockResolvedValue([]) },
    rating: { findMany: jest.fn().mockResolvedValue([]) },
    userMediaStatus: { findMany: jest.fn().mockResolvedValue([]) },
    watchHistory: { findMany: jest.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;
  const reviews = { toUserReviews: jest.fn().mockResolvedValue([]) } as unknown as ReviewsService;
  const lists = {
    browse: jest
      .fn()
      .mockImplementation((_v, _q, _m, extra) =>
        Promise.resolve({ lists: extra?.ownerIds ? friendLists : [{ id: 'popular' }], nextCursor: null }),
      ),
  } as unknown as ListsService;
  return { prisma, reviews, lists, svc: new HomeService(prisma, fakeArtwork, reviews, lists) };
}

const media = { id: 'm1', type: 'MOVIE', title: 'Heat', releaseDate: '1995-12-15', posterPath: null };
const actor = { id: 'f1', username: 'f1', displayName: null, avatarUrl: null };

describe('HomeService', () => {
  it('scopes every section to visible followees', async () => {
    const { prisma, lists, svc } = setup(['f1', 'f2']);
    const home = await svc.getHome('viewer-1');
    expect(home.scope).toBe('FOLLOWING');

    for (const call of (prisma.activityEvent.findMany as jest.Mock).mock.calls) {
      expect(call[0].where.actorId).toEqual({ in: ['f1', 'f2'] });
      expect(call[0].where.actor).toEqual(visibleUserWhere('viewer-1'));
    }
    const reviewWhere = (prisma.review.findMany as jest.Mock).mock.calls[0][0].where;
    expect(reviewWhere.userId).toEqual({ in: ['f1', 'f2'] });
    expect(reviewWhere.user).toEqual(visibleUserWhere('viewer-1'));
    // Lists go through ListsService.browse, which applies public + visibility.
    expect((lists.browse as jest.Mock).mock.calls[0][0]).toBe('viewer-1');
    expect((lists.browse as jest.Mock).mock.calls[0][3]).toEqual({ ownerIds: ['f1', 'f2'] });
  });

  it('falls back to everyone else on the instance when following nobody', async () => {
    const { prisma, svc } = setup([]);
    const home = await svc.getHome('viewer-1');
    expect(home.scope).toBe('EVERYONE');
    expect(home.recentListsSource).toBe('POPULAR');
    expect(home.recentLists).toEqual([{ id: 'popular' }]);
    const where = (prisma.activityEvent.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.actorId).toEqual({ not: 'viewer-1' });
    expect(where.actor).toEqual(visibleUserWhere('viewer-1'));
  });

  it('dedupes friend activity per (member, title) and attaches their rating, like, review, rewatch', async () => {
    const { prisma, svc } = setup(['f1'], [{ id: 'friend-list' }]);
    const ev = (id: string, type: string) => ({
      id, type, actorId: 'f1', mediaItemId: 'm1', actor, media, createdAt: new Date('2026-11-16T10:00:00Z'),
    });
    (prisma.activityEvent.findMany as jest.Mock).mockImplementation((args: { where: { type: { in: string[] } } }) =>
      Promise.resolve(args.where.type.in.includes('REVIEWED') ? [ev('e2', 'REVIEWED'), ev('e1', 'WATCHED')] : [ev('e1', 'WATCHED')]),
    );
    (prisma.rating.findMany as jest.Mock).mockResolvedValue([{ userId: 'f1', mediaItemId: 'm1', value: 80 }]);
    (prisma.userMediaStatus.findMany as jest.Mock).mockResolvedValue([{ userId: 'f1', mediaItemId: 'm1' }]);
    (prisma.review.findMany as jest.Mock).mockImplementation((args: { include?: unknown }) =>
      Promise.resolve(args.include ? [] : [{ id: 'r1', userId: 'f1', mediaItemId: 'm1' }]),
    );
    (prisma.watchHistory.findMany as jest.Mock).mockResolvedValue([
      { userId: 'f1', mediaItemId: 'm1', isRewatch: true },
    ]);

    const home = await svc.getHome('viewer-1');
    expect(home.newFromFriends).toHaveLength(1);
    expect(home.newFromFriends[0]).toMatchObject({
      id: 'e2', type: 'REVIEWED', rating: 80, liked: true, reviewId: 'r1', isRewatch: true,
    });
    expect(home.popularWithFriends).toEqual([
      { media: expect.objectContaining({ id: 'm1' }), count: 1, members: [actor] },
    ]);
    expect(home.recentListsSource).toBe('FOLLOWING');
  });
});
