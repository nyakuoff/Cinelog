import { z } from 'zod';
import { ActivityFeedQuery } from './follows.js';
import { ListSummary } from './lists.js';
import { UserReview } from './reviews.js';
import { MediaSummary } from './social.js';

const ActorSummary = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});
export type ActorSummary = z.infer<typeof ActorSummary>;

/** GET /search/members and GET /search/lists — case-insensitive substring
 *  match (username/displayName; list title/description). */
export const CommunitySearchQuery = z.object({
  q: z.string().trim().min(1, 'Query is required'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(60).optional().default(24),
});
export type CommunitySearchQuery = z.infer<typeof CommunitySearchQuery>;

/** GET /users/:username/activity — that member's own events, same item shape
 *  and visibility rules as GET /activity. */
export const ProfileActivityQuery = ActivityFeedQuery.omit({ scope: true });
export type ProfileActivityQuery = z.infer<typeof ProfileActivityQuery>;

export const ProfileLikesKind = z.enum(['titles', 'reviews', 'lists']);
export type ProfileLikesKind = z.infer<typeof ProfileLikesKind>;

/** GET /users/:username/likes?kind= */
export const ProfileLikesQuery = z.object({
  kind: ProfileLikesKind.optional().default('titles'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(60).optional().default(30),
});
export type ProfileLikesQuery = z.infer<typeof ProfileLikesQuery>;

/** Only the array for the requested `kind` is filled; the others are empty. */
export const ProfileLikesResponse = z.object({
  kind: ProfileLikesKind,
  titles: z.array(MediaSummary),
  reviews: z.array(UserReview),
  lists: z.array(ListSummary),
  nextCursor: z.string().nullable(),
});
export type ProfileLikesResponse = z.infer<typeof ProfileLikesResponse>;

/** One recent watch/rate/review by someone, de-duplicated per (member, title). */
export const HomeFriendEntry = z.object({
  /** The activity event id. */
  id: z.string(),
  type: z.enum(['WATCHED', 'RATED', 'REVIEWED']),
  actor: ActorSummary,
  media: MediaSummary,
  /** The member's current rating, normalized 0..100. */
  rating: z.number().min(0).max(100).nullable(),
  liked: z.boolean(),
  reviewId: z.string().nullable(),
  /** Whether their latest diary entry for the title is a rewatch. */
  isRewatch: z.boolean(),
  createdAt: z.string().datetime(),
});
export type HomeFriendEntry = z.infer<typeof HomeFriendEntry>;

export const HomePopularEntry = z.object({
  media: MediaSummary,
  /** Distinct members who logged or rated it in the last 7 days. */
  count: z.number().int(),
  /** Up to three of them, most recent first. */
  members: z.array(ActorSummary),
});
export type HomePopularEntry = z.infer<typeof HomePopularEntry>;

/** GET /home (signed in). `scope` is FOLLOWING when the viewer follows anyone,
 *  else EVERYONE (instance-wide fallback). `recentListsSource` says whether
 *  the lists are followees' recent lists or the instance's popular ones. */
export const HomeResponse = z.object({
  scope: z.enum(['FOLLOWING', 'EVERYONE']),
  newFromFriends: z.array(HomeFriendEntry),
  popularWithFriends: z.array(HomePopularEntry),
  /** Spoiler bodies are concealed, same as review lists. */
  friendReviews: z.array(UserReview),
  recentLists: z.array(ListSummary),
  recentListsSource: z.enum(['FOLLOWING', 'POPULAR']),
});
export type HomeResponse = z.infer<typeof HomeResponse>;
