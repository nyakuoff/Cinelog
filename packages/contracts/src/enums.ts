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
  'PLAN_TO_WATCH',
  'ON_HOLD',
  'DROPPED',
  'REWATCHING',
]);
export type TrackingStatus = z.infer<typeof TrackingStatus>;

/** User account role. */
export const UserRole = z.enum(['ADMIN', 'USER']);
export type UserRole = z.infer<typeof UserRole>;

/** Configurable rating scales. Values are stored normalized 0..100; the scale controls display + input. */
export const RatingScale = z.enum(['FIVE_STAR', 'FIVE_STAR_HALF', 'TEN', 'HUNDRED']);
export type RatingScale = z.infer<typeof RatingScale>;

/** Artwork kinds a provider may expose. */
export const ArtworkType = z.enum(['POSTER', 'BACKDROP', 'LOGO', 'BANNER']);
export type ArtworkType = z.infer<typeof ArtworkType>;

/** What a rating or review is attached to. */
export const TargetType = z.enum(['MEDIA', 'SEASON', 'EPISODE']);
export type TargetType = z.infer<typeof TargetType>;
