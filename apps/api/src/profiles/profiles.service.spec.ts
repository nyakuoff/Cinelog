import { ProfilesService } from './profiles.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ArtworkService } from '../artwork/artwork.service';
import type { ReviewsService } from '../reviews/reviews.service';

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
) {
  return {
    user: { findUnique: jest.fn().mockResolvedValue(user) },
    follow: {
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn().mockResolvedValue(followExists ? { id: 'f1' } : null),
    },
    userMediaStatus: { findMany: jest.fn().mockResolvedValue(watchlistRows) },
    watchHistory: { findMany: jest.fn().mockResolvedValue([]) },
    rating: { findMany: jest.fn().mockResolvedValue([]) },
    episodeRating: { count: jest.fn().mockResolvedValue(0) },
    mediaItem: { findMany: jest.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;
}

const fakeArtwork = { toProxyUrl: (u: string | null) => u } as unknown as ArtworkService;
const fakeReviews = {} as unknown as ReviewsService;

describe('ProfilesService privacy', () => {
  it('a PUBLIC profile is visible to anonymous and any signed-in viewer', async () => {
    const svc = new ProfilesService(makePrisma(makeUser({ profileVisibility: 'PUBLIC' }), false), fakeArtwork, fakeReviews);
    expect((await svc.getPublicProfile('owner', undefined)).canView).toBe(true);
    expect((await svc.getPublicProfile('owner', 'someone-else')).canView).toBe(true);
  });

  it('a PRIVATE profile is hidden from everyone but the owner, and leaks no bio', async () => {
    const svc = new ProfilesService(makePrisma(makeUser({ profileVisibility: 'PRIVATE' }), false), fakeArtwork, fakeReviews);
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
    );
    expect((await notFollowing.getPublicProfile('owner', 'viewer-1')).canView).toBe(false);
    expect((await notFollowing.getPublicProfile('owner', undefined)).canView).toBe(false);

    const following = new ProfilesService(
      makePrisma(makeUser({ profileVisibility: 'FOLLOWERS' }), true),
      fakeArtwork,
      fakeReviews,
    );
    expect((await following.getPublicProfile('owner', 'viewer-1')).canView).toBe(true);
  });

  it('watchlist visibility is gated independently and never exceeds profile visibility', async () => {
    const svc = new ProfilesService(
      makePrisma(
        makeUser({ profileVisibility: 'PUBLIC', watchlistVisibility: 'PRIVATE' }),
        false,
      ),
      fakeArtwork,
      fakeReviews,
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
    );
    expect((await allowed.getWatchlist('owner', 'viewer-1')).items).toHaveLength(1);

    const denied = new ProfilesService(
      makePrisma(makeUser({ watchlistVisibility: 'PRIVATE' }), false, rows),
      fakeArtwork,
      fakeReviews,
    );
    expect((await denied.getWatchlist('owner', 'viewer-1')).items).toHaveLength(0);
  });
});
