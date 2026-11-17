import { NotFoundException } from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ArtworkService } from '../artwork/artwork.service';
import type { ReviewsService } from '../reviews/reviews.service';
import type { ListsService } from '../lists/lists.service';

function makeUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'owner-1',
    username: 'owner',
    displayName: null,
    avatarUrl: null,
    bannerUrl: null,
    bio: 'hello',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    profileVisibility: 'PUBLIC',
    watchlistVisibility: 'PUBLIC',
    ...overrides,
  };
}

function makePrisma(
  user: ReturnType<typeof makeUser>,
  followExists: boolean,
  watchlistRows: unknown[] = [],
  blocked = false,
) {
  return {
    user: { findUnique: jest.fn().mockResolvedValue(user) },
    userBlock: { count: jest.fn().mockResolvedValue(blocked ? 1 : 0) },
    follow: {
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn().mockResolvedValue(followExists ? { id: 'f1' } : null),
    },
    userMediaStatus: { findMany: jest.fn().mockResolvedValue(watchlistRows) },
    watchHistory: { findMany: jest.fn().mockResolvedValue([]) },
    rating: { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) },
    userPosterOverride: { findMany: jest.fn().mockResolvedValue([]) },
    episodeRating: { count: jest.fn().mockResolvedValue(0) },
    review: { findMany: jest.fn().mockResolvedValue([]) },
    mediaItem: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
  } as unknown as PrismaService;
}

const fakeArtwork = { toProxyUrl: (u: string | null) => u } as unknown as ArtworkService;
const fakeReviews = {} as unknown as ReviewsService;
const fakeLists = {} as unknown as ListsService;

describe('ProfilesService privacy', () => {
  it('a PUBLIC profile is visible to anonymous and any signed-in viewer', async () => {
    const svc = new ProfilesService(makePrisma(makeUser({ profileVisibility: 'PUBLIC' }), false), fakeArtwork, fakeReviews, fakeLists);
    expect((await svc.getPublicProfile('owner', undefined)).canView).toBe(true);
    expect((await svc.getPublicProfile('owner', 'someone-else')).canView).toBe(true);
  });

  it('a PRIVATE profile is hidden from everyone but the owner, and leaks no bio', async () => {
    const svc = new ProfilesService(makePrisma(makeUser({ profileVisibility: 'PRIVATE' }), false), fakeArtwork, fakeReviews, fakeLists);
    const anon = await svc.getPublicProfile('owner', undefined);
    expect(anon.canView).toBe(false);
    expect(anon.bio).toBeNull();

    const other = await svc.getPublicProfile('owner', 'someone-else');
    expect(other.canView).toBe(false);

    const self = await svc.getPublicProfile('owner', 'owner-1');
    expect(self.canView).toBe(true);
    expect(self.isOwnProfile).toBe(true);
  });

  it('a FOLLOWERS profile is visible only to an accepted follower', async () => {
    const notFollowing = new ProfilesService(
      makePrisma(makeUser({ profileVisibility: 'FOLLOWERS' }), false),
      fakeArtwork,
      fakeReviews,
      fakeLists,
    );
    expect((await notFollowing.getPublicProfile('owner', 'viewer-1')).canView).toBe(false);
    expect((await notFollowing.getPublicProfile('owner', undefined)).canView).toBe(false);

    const following = new ProfilesService(
      makePrisma(makeUser({ profileVisibility: 'FOLLOWERS' }), true),
      fakeArtwork,
      fakeReviews,
      fakeLists,
    );
    expect((await following.getPublicProfile('owner', 'viewer-1')).canView).toBe(true);
  });

  it('a block in either direction makes the profile and its tabs not found', async () => {
    const svc = new ProfilesService(
      makePrisma(makeUser({ profileVisibility: 'PUBLIC' }), true, [], true),
      fakeArtwork,
      fakeReviews,
      fakeLists,
    );
    await expect(svc.getPublicProfile('owner', 'viewer-1')).rejects.toThrow(NotFoundException);
    await expect(svc.getDiary('owner', 'viewer-1')).rejects.toThrow(NotFoundException);
    await expect(svc.getWatched('owner', 'viewer-1')).rejects.toThrow(NotFoundException);
    await expect(svc.getWatchlist('owner', 'viewer-1')).rejects.toThrow(NotFoundException);
  });

  it('watchlist visibility is gated independently and never exceeds profile visibility', async () => {
    const svc = new ProfilesService(
      makePrisma(
        makeUser({ profileVisibility: 'PUBLIC', watchlistVisibility: 'PRIVATE' }),
        false,
      ),
      fakeArtwork,
      fakeReviews,
      fakeLists,
    );
    const profile = await svc.getPublicProfile('owner', 'viewer-1');
    expect(profile.canView).toBe(true);
    expect(profile.canViewWatchlist).toBe(false);
  });

  it('getWatchlist returns items when allowed and an empty list when not, never an error', async () => {
    const rows = [
      {
        favoritePosition: null,
        media: { id: 'm1', type: 'MOVIE', title: 'Dune', releaseDate: '2021-01-01', posterPath: null },
      },
    ];
    const allowed = new ProfilesService(
      makePrisma(makeUser({ watchlistVisibility: 'PUBLIC' }), false, rows),
      fakeArtwork,
      fakeReviews,
      fakeLists,
    );
    expect((await allowed.getWatchlist('owner', 'viewer-1')).items).toHaveLength(1);

    const denied = new ProfilesService(
      makePrisma(makeUser({ watchlistVisibility: 'PRIVATE' }), false, rows),
      fakeArtwork,
      fakeReviews,
      fakeLists,
    );
    expect((await denied.getWatchlist('owner', 'viewer-1')).items).toHaveLength(0);
  });
});

describe('ProfilesService diary pagination & likes', () => {
  const at = (iso: string) => new Date(iso);
  const media = { id: 'm1', type: 'MOVIE', title: 'Dune', releaseDate: '2021-01-01', posterPath: null };
  const row = (id: string, iso: string) => ({ id, mediaItemId: 'm1', watchedAt: at(iso), isRewatch: false, media });

  it('returns a keyset cursor from the last entry, and a cursor resumes strictly after it', async () => {
    const prisma = makePrisma(makeUser(), false);
    (prisma.watchHistory.findMany as jest.Mock).mockResolvedValue([
      row('h3', '2026-03-03T12:00:00.000Z'),
      row('h2', '2026-03-02T12:00:00.000Z'),
      row('h1', '2026-03-01T12:00:00.000Z'), // the +1 probe row
    ]);
    const svc = new ProfilesService(prisma, fakeArtwork, fakeReviews, fakeLists);
    const page = await svc.getDiary('owner', 'viewer-1', { limit: 2 });
    expect(page.entries.map((e) => e.id)).toEqual(['h3', 'h2']);
    expect(page.nextCursor).toBe('2026-03-02T12:00:00.000Z|h2');
    expect((prisma.watchHistory.findMany as jest.Mock).mock.calls[0][0]).toMatchObject({
      orderBy: [{ watchedAt: 'desc' }, { id: 'desc' }],
      take: 3,
    });

    (prisma.watchHistory.findMany as jest.Mock).mockResolvedValue([row('h1', '2026-03-01T12:00:00.000Z')]);
    const next = await svc.getDiary('owner', 'viewer-1', { limit: 2, cursor: page.nextCursor! });
    expect(next.nextCursor).toBeNull();
    const where = (prisma.watchHistory.findMany as jest.Mock).mock.calls[1][0].where;
    expect(where.OR).toEqual([
      { watchedAt: { lt: at('2026-03-02T12:00:00.000Z') } },
      { watchedAt: at('2026-03-02T12:00:00.000Z'), id: { lt: 'h2' } },
    ]);
  });

  it('year/month narrow the diary to that UTC month', async () => {
    const prisma = makePrisma(makeUser(), false);
    const svc = new ProfilesService(prisma, fakeArtwork, fakeReviews, fakeLists);
    await svc.getDiary('owner', undefined, { year: 2025, month: 12 });
    const where = (prisma.watchHistory.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.watchedAt).toEqual({
      gte: at('2025-12-01T00:00:00.000Z'),
      lt: at('2026-01-01T00:00:00.000Z'),
    });
  });

  it('likes on a hidden profile are empty without touching likes; a block is a 404', async () => {
    const lists = { listLikedBy: jest.fn() } as unknown as ListsService;
    const reviews = { listLikedBy: jest.fn() } as unknown as ReviewsService;
    const hidden = makePrisma(makeUser({ profileVisibility: 'PRIVATE' }), false);
    const svc = new ProfilesService(hidden, fakeArtwork, reviews, lists);
    for (const kind of ['titles', 'reviews', 'lists'] as const) {
      await expect(svc.getLikes('owner', 'viewer-1', { kind, limit: 30 })).resolves.toMatchObject({
        titles: [],
        reviews: [],
        lists: [],
        nextCursor: null,
      });
    }
    expect(lists.listLikedBy).not.toHaveBeenCalled();
    expect(reviews.listLikedBy).not.toHaveBeenCalled();
    expect(hidden.userMediaStatus.findMany).not.toHaveBeenCalled();

    const blocked = new ProfilesService(makePrisma(makeUser(), false, [], true), fakeArtwork, reviews, lists);
    await expect(blocked.getLikes('owner', 'viewer-1', { kind: 'titles', limit: 30 })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('liked reviews/lists are delegated with the viewer, so they apply their own visibility', async () => {
    const lists = { listLikedBy: jest.fn().mockResolvedValue({ lists: [], nextCursor: null }) } as unknown as ListsService;
    const reviews = { listLikedBy: jest.fn().mockResolvedValue({ reviews: [], nextCursor: null }) } as unknown as ReviewsService;
    const svc = new ProfilesService(makePrisma(makeUser(), false), fakeArtwork, reviews, lists);
    await svc.getLikes('owner', 'viewer-1', { kind: 'reviews', limit: 30 });
    await svc.getLikes('owner', 'viewer-1', { kind: 'lists', limit: 30 });
    expect(reviews.listLikedBy).toHaveBeenCalledWith('owner-1', 'viewer-1', undefined, 30);
    expect(lists.listLikedBy).toHaveBeenCalledWith('owner-1', 'viewer-1', undefined, 30);
  });
});
