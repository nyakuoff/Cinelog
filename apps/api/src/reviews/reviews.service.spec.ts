import { ForbiddenException } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { MediaService } from '../media/media.service';
import type { ArtworkService } from '../artwork/artwork.service';
import type { ActivityService } from '../social/activity.service';

function makeUser(id: string) {
  return { id, username: `user-${id}`, displayName: null, avatarUrl: null };
}

function makeReviewRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'review-1',
    userId: 'author-1',
    mediaItemId: 'media-1',
    targetType: 'MEDIA',
    body: 'A great watch.',
    ratingValue: 90,
    watchedDate: null,
    isSpoiler: false,
    likeCount: 0,
    commentCount: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    editedAt: null,
    user: makeUser('author-1'),
    ...overrides,
  };
}

function makePrisma(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    review: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    reviewLike: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    reviewComment: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    follow: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn(async (ops: unknown[] | ((tx: unknown) => unknown)) => {
      if (Array.isArray(ops)) return Promise.all(ops as Promise<unknown>[]);
      return (ops as (tx: unknown) => unknown)(undefined);
    }),
    ...overrides,
  } as unknown as PrismaService;
}

const fakeMedia = {} as unknown as MediaService;
const fakeArtwork = { toProxyUrl: (u: string | null) => u } as unknown as ArtworkService;
const fakeActivity = {
  record: jest.fn().mockResolvedValue(undefined),
  recordReplacing: jest.fn().mockResolvedValue(undefined),
} as unknown as ActivityService;

/** Single construction point so DI changes don't ripple through every test. */
function makeService(prisma: PrismaService): ReviewsService {
  return new ReviewsService(prisma, fakeMedia, fakeArtwork, fakeActivity);
}

describe('ReviewsService', () => {
  it('spoiler reviews conceal the body from everyone but the author in list results', async () => {
    const prisma = makePrisma();
    (prisma.review.findMany as jest.Mock).mockResolvedValue([
      makeReviewRow({ isSpoiler: true, body: 'The ending twist is...' }),
    ]);
    const svc = makeService(prisma);

    const asStranger = await svc.list('media-1', 'someone-else', {
      sort: 'RECENT',
      limit: 20,
    } as never);
    expect(asStranger.reviews[0]?.concealed).toBe(true);
    expect(asStranger.reviews[0]?.body).toBe('');

    const asAuthor = await svc.list('media-1', 'author-1', { sort: 'RECENT', limit: 20 } as never);
    expect(asAuthor.reviews[0]?.concealed).toBe(false);
    expect(asAuthor.reviews[0]?.body).toBe('The ending twist is...');
  });

  it('getById always reveals the full body (explicit open = explicit reveal)', async () => {
    const prisma = makePrisma();
    (prisma.review.findUnique as jest.Mock).mockResolvedValue(
      makeReviewRow({ isSpoiler: true, body: 'Spoiler content' }),
    );
    const svc = makeService(prisma);
    const result = await svc.getById('review-1', 'someone-else');
    expect(result.concealed).toBe(false);
    expect(result.body).toBe('Spoiler content');
  });

  it('only the author can edit or delete their review', async () => {
    const prisma = makePrisma();
    (prisma.review.findUnique as jest.Mock).mockResolvedValue(makeReviewRow());
    const svc = makeService(prisma);

    await expect(svc.update('someone-else', 'review-1', { body: 'edited' })).rejects.toThrow(
      ForbiddenException,
    );
    await expect(svc.remove('someone-else', 'review-1')).rejects.toThrow(ForbiddenException);
  });

  it('a duplicate like is a no-op rather than an error (DB unique constraint backstop)', async () => {
    const prisma = makePrisma();
    (prisma.review.findUnique as jest.Mock).mockResolvedValue(makeReviewRow());
    (prisma.$transaction as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('duplicate'), { code: 'P2002' }),
    );
    const svc = makeService(prisma);
    await expect(svc.like('viewer-1', 'review-1')).resolves.toBeUndefined();
  });

  it('only the comment author can edit or delete their comment', async () => {
    const prisma = makePrisma();
    (prisma.reviewComment.findUnique as jest.Mock).mockResolvedValue({
      id: 'comment-1',
      reviewId: 'review-1',
      userId: 'commenter-1',
      body: 'nice review',
    });
    const svc = makeService(prisma);

    await expect(svc.updateComment('someone-else', 'comment-1', { body: 'edited' })).rejects.toThrow(
      ForbiddenException,
    );
    await expect(svc.deleteComment('someone-else', 'comment-1')).rejects.toThrow(ForbiddenException);
  });
});
