import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { MediaItem, Review as ReviewRow, ReviewComment as CommentRow, User } from '@prisma/client';
import { MediaType } from '@cinelog/contracts';
import type {
  CreateReviewCommentRequest,
  CreateReviewRequest,
  Review,
  ReviewComment,
  ReviewCommentListResponse,
  ReviewListQuery,
  ReviewListResponse,
  UpdateReviewCommentRequest,
  UpdateReviewRequest,
  UserReview,
  UserReviewListResponse,
} from '@cinelog/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { ArtworkService } from '../artwork/artwork.service';
import { ActivityService } from '../social/activity.service';

type ReviewWithAuthor = ReviewRow & { user: User };
type CommentWithAuthor = CommentRow & { user: User };

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly artwork: ArtworkService,
    private readonly activity: ActivityService,
  ) {}

  async create(userId: string, mediaRefId: string, dto: CreateReviewRequest): Promise<Review> {
    const mediaItemId = (await this.media.resolveRef({ mediaId: mediaRefId })).id;
    const targetType = dto.targetType ?? 'MEDIA';

    const existing = await this.prisma.review.findUnique({
      where: { userId_mediaItemId_targetType: { userId, mediaItemId, targetType } },
    });
    if (existing) {
      throw new ConflictException('You already reviewed this title — edit your existing review instead');
    }

    const row = await this.prisma.review.create({
      data: {
        userId,
        mediaItemId,
        targetType,
        body: dto.body,
        ratingValue: dto.ratingValue ?? null,
        watchedDate: dto.watchedDate ? new Date(dto.watchedDate) : null,
        isSpoiler: dto.isSpoiler ?? false,
      },
      include: { user: true },
    });
    await this.activity.recordReplacing({
      actorId: userId,
      type: 'REVIEWED',
      mediaItemId,
      reviewId: row.id,
    });
    return this.toReview(row, userId);
  }

  async update(userId: string, reviewId: string, dto: UpdateReviewRequest): Promise<Review> {
    const row = await this.requireOwnedReview(userId, reviewId);
    const updated = await this.prisma.review.update({
      where: { id: row.id },
      data: {
        ...(dto.body !== undefined ? { body: dto.body } : {}),
        ...(dto.ratingValue !== undefined ? { ratingValue: dto.ratingValue } : {}),
        ...(dto.watchedDate !== undefined
          ? { watchedDate: dto.watchedDate ? new Date(dto.watchedDate) : null }
          : {}),
        ...(dto.isSpoiler !== undefined ? { isSpoiler: dto.isSpoiler } : {}),
        editedAt: new Date(),
      },
      include: { user: true },
    });
    return this.toReview(updated, userId);
  }

  async remove(userId: string, reviewId: string): Promise<void> {
    const row = await this.requireOwnedReview(userId, reviewId);
    await this.prisma.review.delete({ where: { id: row.id } });
    // ActivityEvent has no FK to Review, so the feed row must be cleared here.
    await this.prisma.activityEvent.deleteMany({
      where: { actorId: userId, type: 'REVIEWED', reviewId: row.id },
    });
  }

  async getById(reviewId: string, viewerId: string | undefined): Promise<Review> {
    const row = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: { user: true },
    });
    if (!row) throw new NotFoundException('Review not found');
    const liked = viewerId ? await this.isLikedBy(reviewId, viewerId) : false;
    return this.toReview(row, viewerId, { reveal: true, liked });
  }

  async list(
    mediaId: string,
    viewerId: string | undefined,
    query: ReviewListQuery,
  ): Promise<ReviewListResponse> {
    const take = query.limit;
    const skip = query.cursor ? Number(query.cursor) : 0;

    const where: Record<string, unknown> = { mediaItemId: mediaId, targetType: 'MEDIA' };
    if (query.sort === 'FOLLOWING') {
      if (!viewerId) return { reviews: [], nextCursor: null };
      const following = await this.prisma.follow.findMany({
        where: { followerId: viewerId },
        select: { followingId: true },
      });
      const ids = following.map((f) => f.followingId);
      if (!ids.length) return { reviews: [], nextCursor: null };
      where.userId = { in: ids };
    }

    const orderBy =
      query.sort === 'HIGHEST'
        ? [{ ratingValue: 'desc' as const }, { createdAt: 'desc' as const }]
        : query.sort === 'LOWEST'
          ? [{ ratingValue: 'asc' as const }, { createdAt: 'desc' as const }]
          : query.sort === 'POPULAR'
            ? [{ likeCount: 'desc' as const }, { createdAt: 'desc' as const }]
            : [{ createdAt: 'desc' as const }];

    const rows = await this.prisma.review.findMany({
      where,
      include: { user: true },
      orderBy,
      take,
      skip,
    });

    const likedIds = viewerId ? await this.likedReviewIds(rows.map((r) => r.id), viewerId) : new Set<string>();

    return {
      reviews: rows.map((r) => this.toReview(r, viewerId, { liked: likedIds.has(r.id) })),
      nextCursor: rows.length >= take ? String(skip + take) : null,
    };
  }

  /** A user's authored reviews for their profile's Reviews tab. Caller (the
   *  profiles module) is responsible for the profile-visibility check. */
  async listByAuthor(
    authorId: string,
    viewerId: string | undefined,
    cursor: string | undefined,
    limit = 20,
  ): Promise<UserReviewListResponse> {
    const skip = cursor ? Number(cursor) : 0;
    const rows = await this.prisma.review.findMany({
      where: { userId: authorId, targetType: 'MEDIA' },
      include: { user: true, media: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip,
    });
    const likedIds = viewerId ? await this.likedReviewIds(rows.map((r) => r.id), viewerId) : new Set<string>();
    const reviews: UserReview[] = rows.map((r) => ({
      ...this.toReview(r, viewerId, { liked: likedIds.has(r.id) }),
      media: this.toMediaSummary(r.media),
    }));
    return { reviews, nextCursor: rows.length >= limit ? String(skip + limit) : null };
  }

  async like(userId: string, reviewId: string): Promise<void> {
    await this.requireReview(reviewId);
    try {
      await this.prisma.$transaction([
        this.prisma.reviewLike.create({ data: { userId, reviewId } }),
        this.prisma.review.update({ where: { id: reviewId }, data: { likeCount: { increment: 1 } } }),
      ]);
    } catch (err) {
      // Unique [userId, reviewId] rejects a duplicate like at the DB level —
      // treat a repeat like as a no-op rather than an error.
      if (!isUniqueConstraintError(err)) throw err;
    }
  }

  async unlike(userId: string, reviewId: string): Promise<void> {
    const existing = await this.prisma.reviewLike.findUnique({
      where: { userId_reviewId: { userId, reviewId } },
    });
    if (!existing) return;
    await this.prisma.$transaction([
      this.prisma.reviewLike.delete({ where: { id: existing.id } }),
      this.prisma.review.update({ where: { id: reviewId }, data: { likeCount: { decrement: 1 } } }),
    ]);
  }

  async listComments(reviewId: string, viewerId: string | undefined, cursor?: string, limit = 30): Promise<ReviewCommentListResponse> {
    const skip = cursor ? Number(cursor) : 0;
    const rows = await this.prisma.reviewComment.findMany({
      where: { reviewId },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
      take: limit,
      skip,
    });
    return {
      comments: rows.map((r) => this.toComment(r, viewerId)),
      nextCursor: rows.length >= limit ? String(skip + limit) : null,
    };
  }

  async addComment(userId: string, reviewId: string, dto: CreateReviewCommentRequest): Promise<ReviewComment> {
    await this.requireReview(reviewId);
    const [row] = await this.prisma.$transaction([
      this.prisma.reviewComment.create({
        data: { reviewId, userId, body: dto.body },
        include: { user: true },
      }),
      this.prisma.review.update({ where: { id: reviewId }, data: { commentCount: { increment: 1 } } }),
    ]);
    return this.toComment(row, userId);
  }

  async updateComment(
    userId: string,
    commentId: string,
    dto: UpdateReviewCommentRequest,
  ): Promise<ReviewComment> {
    const comment = await this.prisma.reviewComment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.userId !== userId) throw new ForbiddenException('You can only edit your own comments');
    const updated = await this.prisma.reviewComment.update({
      where: { id: commentId },
      data: { body: dto.body },
      include: { user: true },
    });
    return this.toComment(updated, userId);
  }

  async deleteComment(userId: string, commentId: string): Promise<void> {
    const comment = await this.prisma.reviewComment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.userId !== userId) throw new ForbiddenException('You can only delete your own comments');
    await this.prisma.$transaction([
      this.prisma.reviewComment.delete({ where: { id: commentId } }),
      this.prisma.review.update({
        where: { id: comment.reviewId },
        data: { commentCount: { decrement: 1 } },
      }),
    ]);
  }

  // -- helpers ---------------------------------------------------------------

  private async requireReview(reviewId: string): Promise<ReviewRow> {
    const row = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!row) throw new NotFoundException('Review not found');
    return row;
  }

  private async requireOwnedReview(userId: string, reviewId: string): Promise<ReviewRow> {
    const row = await this.requireReview(reviewId);
    if (row.userId !== userId) throw new ForbiddenException('You can only edit your own reviews');
    return row;
  }

  private async isLikedBy(reviewId: string, userId: string): Promise<boolean> {
    const like = await this.prisma.reviewLike.findUnique({
      where: { userId_reviewId: { userId, reviewId } },
    });
    return !!like;
  }

  private async likedReviewIds(reviewIds: string[], userId: string): Promise<Set<string>> {
    if (!reviewIds.length) return new Set();
    const likes = await this.prisma.reviewLike.findMany({
      where: { userId, reviewId: { in: reviewIds } },
      select: { reviewId: true },
    });
    return new Set(likes.map((l) => l.reviewId));
  }

  private toReview(
    row: ReviewWithAuthor,
    viewerId: string | undefined,
    opts: { reveal?: boolean; liked?: boolean } = {},
  ): Review {
    const isOwnReview = viewerId === row.userId;
    const concealed = row.isSpoiler && !isOwnReview && !opts.reveal;
    return {
      id: row.id,
      mediaId: row.mediaItemId,
      author: this.toAuthor(row.user),
      body: concealed ? '' : row.body,
      concealed,
      ratingValue: row.ratingValue,
      watchedDate: row.watchedDate?.toISOString() ?? null,
      isSpoiler: row.isSpoiler,
      likeCount: row.likeCount,
      commentCount: row.commentCount,
      likedByViewer: opts.liked ?? false,
      isOwnReview,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      editedAt: row.editedAt?.toISOString() ?? null,
    };
  }

  private toComment(row: CommentWithAuthor, viewerId: string | undefined): ReviewComment {
    return {
      id: row.id,
      reviewId: row.reviewId,
      author: this.toAuthor(row.user),
      body: row.body,
      isOwnComment: viewerId === row.userId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toMediaSummary(media: MediaItem): UserReview['media'] {
    return {
      id: media.id,
      type: MediaType.catch('MOVIE').parse(media.type),
      title: media.title,
      year: media.releaseDate ? Number(media.releaseDate.slice(0, 4)) || null : null,
      posterUrl: this.artwork.toProxyUrl(media.posterPath),
    };
  }

  private toAuthor(user: User): Review['author'] {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    };
  }
}

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002';
}
