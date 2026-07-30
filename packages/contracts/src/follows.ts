import { z } from 'zod';
import { ActivityType } from './enums.js';
import { MediaSummary } from './social.js';

/** A user as shown in follower/following lists, member grids, and search. */
export const MemberSummary = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  bio: z.string().nullable(),
  /** Whether the requesting viewer follows this member. Null when anonymous. */
  isFollowedByViewer: z.boolean().nullable(),
  /** Whether this member follows the viewer back — powers "mutual" badges. */
  followsViewer: z.boolean().nullable(),
  isSelf: z.boolean(),
  followerCount: z.number().int(),
  filmCount: z.number().int(),
});
export type MemberSummary = z.infer<typeof MemberSummary>;

export const MemberListResponse = z.object({
  members: z.array(MemberSummary),
  nextCursor: z.string().nullable(),
});
export type MemberListResponse = z.infer<typeof MemberListResponse>;

export const FollowStateResponse = z.object({
  following: z.boolean(),
  followerCount: z.number().int(),
});
export type FollowStateResponse = z.infer<typeof FollowStateResponse>;

export const MemberSort = z.enum(['POPULAR', 'RECENT', 'ACTIVE']);
export type MemberSort = z.infer<typeof MemberSort>;

export const MemberListQuery = z.object({
  sort: MemberSort.optional().default('POPULAR'),
  q: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(60).optional().default(30),
});
export type MemberListQuery = z.infer<typeof MemberListQuery>;

/** One entry in a following activity feed. */
export const ActivityItem = z.object({
  id: z.string(),
  type: ActivityType,
  actor: z.object({
    id: z.string(),
    username: z.string(),
    displayName: z.string().nullable(),
    avatarUrl: z.string().nullable(),
  }),
  media: MediaSummary.nullable(),
  /** Rating attached to the event, normalized 0..100, when relevant. */
  ratingValue: z.number().min(0).max(100).nullable(),
  reviewId: z.string().nullable(),
  listId: z.string().nullable(),
  targetUser: z
    .object({ id: z.string(), username: z.string(), displayName: z.string().nullable() })
    .nullable(),
  createdAt: z.string().datetime(),
  /** Extra titles folded into this row when one member logged several at once. */
  groupedMedia: z.array(MediaSummary),
});
export type ActivityItem = z.infer<typeof ActivityItem>;

export const ActivityFeedResponse = z.object({
  items: z.array(ActivityItem),
  nextCursor: z.string().nullable(),
});
export type ActivityFeedResponse = z.infer<typeof ActivityFeedResponse>;

export const ActivityFeedQuery = z.object({
  /** FOLLOWING restricts to people the viewer follows; EVERYONE is instance-wide. */
  scope: z.enum(['FOLLOWING', 'EVERYONE']).optional().default('FOLLOWING'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(25),
  /** Restrict to these event kinds; omit for everything. Accepts a
   *  comma-separated query param as well as a real array. */
  types: z
    .preprocess(
      (v) => (typeof v === 'string' ? v.split(',').filter(Boolean) : v),
      z.array(ActivityType),
    )
    .optional(),
});
export type ActivityFeedQuery = z.infer<typeof ActivityFeedQuery>;
