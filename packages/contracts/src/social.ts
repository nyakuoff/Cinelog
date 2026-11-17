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
  favoriteFilms: z.array(FavoriteSlot),
  favoriteShows: z.array(FavoriteSlot),
  stats: ProfileStats,
  ratingDistribution: z.array(RatingDistributionBucket),
  topGenres: z.array(GenreBreakdownEntry),
  followerCount: z.number().int(),
  followingCount: z.number().int(),
  /** Whether the requesting viewer follows this profile. Null when anonymous. */
  isFollowedByViewer: z.boolean().nullable(),
  /** Whether this profile follows the viewer back. Null when anonymous. */
  followsViewer: z.boolean().nullable(),
});
export type PublicProfile = z.infer<typeof PublicProfile>;

export const ProfileDiaryEntry = z.object({
  id: z.string(),
  media: MediaSummary,
  watchedAt: z.string().datetime(),
  isRewatch: z.boolean(),
  rating: z.number().min(0).max(100).nullable(),
  /** The owner's like (heart) on this title. Media type is `media.type`.
   *  Diary entries are title-level: there is no season/episode context. */
  liked: z.boolean().optional(),
  /** The owner's review of this title, if any (visible whenever the diary is). */
  reviewId: z.string().nullable().optional(),
});
export type ProfileDiaryEntry = z.infer<typeof ProfileDiaryEntry>;

export const ProfileDiaryResponse = z.object({
  entries: z.array(ProfileDiaryEntry),
  nextCursor: z.string().nullable().optional(),
});
export type ProfileDiaryResponse = z.infer<typeof ProfileDiaryResponse>;

/** `?a=true` / `?a=false` query flags. */
const queryBool = z.enum(['true', 'false']).transform((v) => v === 'true');

/** GET /users/:username/diary — newest first, keyset-paginated. `year`/`month`
 *  narrow to a calendar month/year of the watch date (UTC). */
export const ProfileDiaryQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(100),
  year: z.coerce.number().int().min(1870).max(3000).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});
export type ProfileDiaryQuery = z.infer<typeof ProfileDiaryQuery>;

export const ProfileWatchlistResponse = z.object({
  items: z.array(MediaSummary),
});
export type ProfileWatchlistResponse = z.infer<typeof ProfileWatchlistResponse>;

/** One watched title on a member's profile — the "Watched" tab, a poster grid
 *  of everything they've rated, marked completed, or logged, with the rating
 *  overlaid when one exists (mirrors Letterboxd's Films grid). This is the
 *  same membership test used for the profile's Films/Shows stats, so the
 *  count in the header always matches what's in the grid. */
export const ProfileWatchedEntry = z.object({
  media: MediaSummary,
  rating: z.number().min(0).max(100).nullable(),
  watchedAt: z.string().datetime(),
  /** The owner's like (heart) on this title. */
  liked: z.boolean().optional(),
});
export type ProfileWatchedEntry = z.infer<typeof ProfileWatchedEntry>;

export const ProfileWatchedResponse = z.object({
  entries: z.array(ProfileWatchedEntry),
  nextCursor: z.string().nullable().optional(),
});
export type ProfileWatchedResponse = z.infer<typeof ProfileWatchedResponse>;

export const ProfileWatchedSort = z.enum([
  'WATCHED_DESC',
  'RATING_DESC',
  'RATING_ASC',
  'RELEASE_DESC',
  'RELEASE_ASC',
  'TITLE',
  /** Most recently rated first; unrated titles last. */
  'RATED_DESC',
]);
export type ProfileWatchedSort = z.infer<typeof ProfileWatchedSort>;

/** GET /users/:username/watched. `type=films` is MOVIE + DOCUMENTARY, `shows`
 *  everything episodic. `decade` is the first year, e.g. 1990. Omitting
 *  `limit` returns every entry (the original, unpaginated behaviour). */
export const ProfileWatchedQuery = z.object({
  sort: ProfileWatchedSort.optional().default('WATCHED_DESC'),
  type: z.enum(['films', 'shows', 'all']).optional().default('all'),
  decade: z.coerce.number().int().optional(),
  genre: z.string().optional(),
  liked: queryBool.optional(),
  rated: queryBool.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});
export type ProfileWatchedQuery = z.infer<typeof ProfileWatchedQuery>;

/** A single rating from someone the viewer follows, for the "Ratings from
 *  people you follow" panel on a film's page. */
export const FriendRating = z.object({
  user: z.object({
    username: z.string(),
    displayName: z.string().nullable(),
    avatarUrl: z.string().nullable(),
  }),
  ratingValue: z.number().min(0).max(100),
  ratedAt: z.string().datetime(),
});
export type FriendRating = z.infer<typeof FriendRating>;

export const FriendRatingsResponse = z.object({
  ratings: z.array(FriendRating),
});
export type FriendRatingsResponse = z.infer<typeof FriendRatingsResponse>;
