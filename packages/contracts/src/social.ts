import { z } from 'zod';
import { MediaType, ProfileVisibility } from './enums.js';

/** Lightweight media reference used throughout profile/social payloads (favorites,
 *  watchlist, diary) — a trimmed-down sibling of LibraryItem. */
export const MediaSummary = z.object({
  id: z.string(),
  type: MediaType,
  title: z.string(),
  year: z.number().int().nullable(),
  posterUrl: z.string().nullable(),
});
export type MediaSummary = z.infer<typeof MediaSummary>;

export const FavoriteSlot = z.object({
  position: z.number().int().min(1).max(4),
  media: MediaSummary,
});
export type FavoriteSlot = z.infer<typeof FavoriteSlot>;

export const ProfileStats = z.object({
  moviesWatched: z.number().int(),
  showsWatched: z.number().int(),
  episodesWatched: z.number().int(),
  totalRatings: z.number().int(),
  averageRating: z.number().min(0).max(100).nullable(),
});
export type ProfileStats = z.infer<typeof ProfileStats>;

export const RatingDistributionBucket = z.object({
  /** 1..10 on a normalized ten-point scale, regardless of the owner's display scale. */
  bucket: z.number().int().min(1).max(10),
  count: z.number().int(),
});
export type RatingDistributionBucket = z.infer<typeof RatingDistributionBucket>;

export const GenreBreakdownEntry = z.object({
  genre: z.string(),
  count: z.number().int(),
});
export type GenreBreakdownEntry = z.infer<typeof GenreBreakdownEntry>;

/** GET /users/:username — visibility-aware. Anonymous/other viewers only ever
 *  receive fields their access level permits; everything else is simply absent. */
export const PublicProfile = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  bannerUrl: z.string().nullable(),
  bio: z.string().nullable(),
  joinedAt: z.string().datetime(),
  isOwnProfile: z.boolean(),
  profileVisibility: ProfileVisibility,
  watchlistVisibility: ProfileVisibility,
  /** Whether the requesting viewer is allowed to see this profile's detail at all. */
  canView: z.boolean(),
  /** Whether the requesting viewer is allowed to see the watchlist tab. */
  canViewWatchlist: z.boolean(),
  favorites: z.array(FavoriteSlot),
  stats: ProfileStats,
  ratingDistribution: z.array(RatingDistributionBucket),
  topGenres: z.array(GenreBreakdownEntry),
  followerCount: z.number().int(),
  followingCount: z.number().int(),
});
export type PublicProfile = z.infer<typeof PublicProfile>;

export const ProfileDiaryEntry = z.object({
  id: z.string(),
  media: MediaSummary,
  watchedAt: z.string().datetime(),
  isRewatch: z.boolean(),
  rating: z.number().min(0).max(100).nullable(),
});
export type ProfileDiaryEntry = z.infer<typeof ProfileDiaryEntry>;

export const ProfileDiaryResponse = z.object({
  entries: z.array(ProfileDiaryEntry),
});
export type ProfileDiaryResponse = z.infer<typeof ProfileDiaryResponse>;

export const ProfileWatchlistResponse = z.object({
  items: z.array(MediaSummary),
});
export type ProfileWatchlistResponse = z.infer<typeof ProfileWatchlistResponse>;
