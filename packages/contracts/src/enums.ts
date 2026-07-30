import { z } from 'zod';

/** The kinds of visual media Cinelog tracks. Everything uses the same interface. */
export const MediaType = z.enum([
  'MOVIE',
  'TV',
  'ANIME',
  'CARTOON',
  'DOCUMENTARY',
  'MINISERIES',
  'SPECIAL',
]);
export type MediaType = z.infer<typeof MediaType>;

/** Which external metadata source an entity originated from. */
export const ProviderId = z.enum(['tmdb', 'tvdb', 'anilist']);
export type ProviderId = z.infer<typeof ProviderId>;

/** Per-user tracking status for a piece of media. */
export const TrackingStatus = z.enum([
  'WATCHING',
  'COMPLETED',
  'ON_HOLD',
  'DROPPED',
  'REWATCHING',
]);
export type TrackingStatus = z.infer<typeof TrackingStatus>;

/** User account role. */
export const UserRole = z.enum(['ADMIN', 'USER']);
export type UserRole = z.infer<typeof UserRole>;

/** Configurable rating scales. Values are stored normalized 0..100; the scale controls display + input. */
export const RatingScale = z.enum([
  'FIVE_STAR',
  'FIVE_STAR_HALF',
  'TEN',
  'TEN_HALF',
  'HUNDRED',
]);
export type RatingScale = z.infer<typeof RatingScale>;

/** Artwork kinds a provider may expose. */
export const ArtworkType = z.enum(['POSTER', 'BACKDROP', 'LOGO', 'BANNER']);
export type ArtworkType = z.infer<typeof ArtworkType>;

/** What a rating or review is attached to. */
export const TargetType = z.enum(['MEDIA', 'SEASON', 'EPISODE']);
export type TargetType = z.infer<typeof TargetType>;

/** Who can see a profile or a user's watchlist. */
export const ProfileVisibility = z.enum(['PUBLIC', 'FOLLOWERS', 'PRIVATE']);
export type ProfileVisibility = z.infer<typeof ProfileVisibility>;

/** Kinds of events recorded in a user's activity stream. */
export const ActivityType = z.enum([
  'RATED',
  'REVIEWED',
  'WATCHED',
  'FAVORITED',
  'LIST_CREATED',
  'LIST_UPDATED',
  'REVIEW_LIKED',
  'FOLLOWED',
]);
export type ActivityType = z.infer<typeof ActivityType>;

/** Kinds of in-app notifications. */
export const NotificationType = z.enum([
  'NEW_FOLLOWER',
  'REVIEW_LIKE',
  'REVIEW_COMMENT',
  'LIST_LIKE',
  'LIST_COMMENT',
  'COMMENT_REPLY',
]);
export type NotificationType = z.infer<typeof NotificationType>;

/** What kind of content a report targets. */
export const ReportTargetType = z.enum(['REVIEW', 'COMMENT', 'LIST', 'PROFILE']);
export type ReportTargetType = z.infer<typeof ReportTargetType>;

/** Lifecycle of a content report. */
export const ReportStatus = z.enum(['OPEN', 'RESOLVED', 'DISMISSED']);
export type ReportStatus = z.infer<typeof ReportStatus>;
