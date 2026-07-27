import { z } from 'zod';
import { TargetType } from './enums.js';
import { MediaSummary } from './social.js';

export const ReviewAuthor = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});
export type ReviewAuthor = z.infer<typeof ReviewAuthor>;

/** In list views, a spoiler review's body is withheld (empty string, `concealed: true`)
 *  until the reader explicitly opens it — GET /reviews/:id always returns the full body. */
export const Review = z.object({
  id: z.string(),
  mediaId: z.string(),
  author: ReviewAuthor,
  body: z.string(),
  concealed: z.boolean(),
  ratingValue: z.number().min(0).max(100).nullable(),
  watchedDate: z.string().datetime().nullable(),
  isSpoiler: z.boolean(),
  likeCount: z.number().int(),
  commentCount: z.number().int(),
  likedByViewer: z.boolean(),
  isOwnReview: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  editedAt: z.string().datetime().nullable(),
});
export type Review = z.infer<typeof Review>;

export const ReviewSort = z.enum(['POPULAR', 'RECENT', 'HIGHEST', 'LOWEST', 'FOLLOWING']);
export type ReviewSort = z.infer<typeof ReviewSort>;

export const ReviewListQuery = z.object({
  sort: ReviewSort.optional().default('POPULAR'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});
export type ReviewListQuery = z.infer<typeof ReviewListQuery>;

export const ReviewListResponse = z.object({
  reviews: z.array(Review),
  nextCursor: z.string().nullable(),
});
export type ReviewListResponse = z.infer<typeof ReviewListResponse>;

/** A review as shown on a profile's Reviews tab — same shape, plus which title it's for. */
export const UserReview = Review.extend({ media: MediaSummary });
export type UserReview = z.infer<typeof UserReview>;

export const UserReviewListResponse = z.object({
  reviews: z.array(UserReview),
  nextCursor: z.string().nullable(),
});
export type UserReviewListResponse = z.infer<typeof UserReviewListResponse>;

/** POST /media/:id/reviews — the media id comes from the route, not the body. */
export const CreateReviewRequest = z.object({
  targetType: TargetType.optional().default('MEDIA'),
  body: z.string().min(1).max(10000),
  ratingValue: z.number().min(0).max(100).nullable().optional(),
  watchedDate: z.string().datetime().nullable().optional(),
  isSpoiler: z.boolean().optional().default(false),
});
export type CreateReviewRequest = z.infer<typeof CreateReviewRequest>;

export const UpdateReviewRequest = z.object({
  body: z.string().min(1).max(10000).optional(),
  ratingValue: z.number().min(0).max(100).nullable().optional(),
  watchedDate: z.string().datetime().nullable().optional(),
  isSpoiler: z.boolean().optional(),
});
export type UpdateReviewRequest = z.infer<typeof UpdateReviewRequest>;

export const ReviewComment = z.object({
  id: z.string(),
  reviewId: z.string(),
  author: ReviewAuthor,
  body: z.string(),
  isOwnComment: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ReviewComment = z.infer<typeof ReviewComment>;

export const ReviewCommentListResponse = z.object({
  comments: z.array(ReviewComment),
  nextCursor: z.string().nullable(),
});
export type ReviewCommentListResponse = z.infer<typeof ReviewCommentListResponse>;

export const CreateReviewCommentRequest = z.object({
  body: z.string().min(1).max(2000),
});
export type CreateReviewCommentRequest = z.infer<typeof CreateReviewCommentRequest>;

export const UpdateReviewCommentRequest = z.object({
  body: z.string().min(1).max(2000),
});
export type UpdateReviewCommentRequest = z.infer<typeof UpdateReviewCommentRequest>;
