import { z } from 'zod';
import { ArtworkType, MediaType, ProviderId, TrackingStatus } from './enums.js';

/** A single search hit from the global search endpoint. */
export const SearchResult = z.object({
  /** Cinelog canonical id if already cached, else null (resolved on open). */
  id: z.string().nullable(),
  provider: ProviderId,
  externalId: z.string(),
  type: MediaType,
  title: z.string(),
  originalTitle: z.string().nullable(),
  year: z.number().int().nullable(),
  overview: z.string().nullable(),
  posterUrl: z.string().nullable(),
});
export type SearchResult = z.infer<typeof SearchResult>;

export const SearchResponse = z.object({
  query: z.string(),
  results: z.array(SearchResult),
});
export type SearchResponse = z.infer<typeof SearchResponse>;

/** PUT /media/:id/rematch — re-point a mismatched cached title at the correct
 *  provider match. The Cinelog id (and every user's tracking/ratings/history
 *  hanging off it) is preserved; only the cached metadata is replaced. */
export const RematchRequest = z.object({
  provider: ProviderId,
  externalId: z.string(),
  type: MediaType,
});
export type RematchRequest = z.infer<typeof RematchRequest>;

export const Genre = z.object({
  id: z.string(),
  name: z.string(),
});
export type Genre = z.infer<typeof Genre>;

export const CreditPerson = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string().nullable(),
  character: z.string().nullable(),
  department: z.string().nullable(),
  profileUrl: z.string().nullable(),
});
export type CreditPerson = z.infer<typeof CreditPerson>;

/** PUT /media/:id/cast (admin only) — replaces the cast list shown to every
 *  user. Stored separately from provider metadata so it survives rematches
 *  and metadata refreshes. */
export const AdminUpdateCastRequest = z.object({
  cast: z.array(
    z.object({
      name: z.string().min(1, 'Name is required'),
      role: z.string().nullable(),
      character: z.string().nullable(),
      department: z.string().nullable(),
      profileUrl: z.string().nullable(),
    }),
  ),
});
export type AdminUpdateCastRequest = z.infer<typeof AdminUpdateCastRequest>;

/** One available image option (used later by the "Change Artwork" gallery). */
export const ArtworkOption = z.object({
  type: ArtworkType,
  url: z.string(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  language: z.string().nullable(),
});
export type ArtworkOption = z.infer<typeof ArtworkOption>;

/** The requesting user's personal state for this media, merged into the detail response. */
export const UserMediaState = z.object({
  status: TrackingStatus.nullable(),
  isFavorite: z.boolean(),
  isWatchlisted: z.boolean(),
  rewatchCount: z.number().int(),
  /** Normalized 0..100, or null if unrated. */
  rating: z.number().min(0).max(100).nullable(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
});
export type UserMediaState = z.infer<typeof UserMediaState>;

/** Full media detail page payload. Artwork URLs are Cinelog-proxied (cached) URLs. */
export const MediaDetail = z.object({
  id: z.string(),
  provider: ProviderId,
  externalId: z.string(),
  type: MediaType,
  title: z.string(),
  originalTitle: z.string().nullable(),
  releaseDate: z.string().nullable(),
  runtime: z.number().int().nullable(),
  overview: z.string().nullable(),
  tagline: z.string().nullable(),
  posterUrl: z.string().nullable(),
  backdropUrl: z.string().nullable(),
  logoUrl: z.string().nullable(),
  genres: z.array(Genre),
  studios: z.array(z.string()),
  cast: z.array(CreditPerson),
  crew: z.array(CreditPerson),
  trailerUrl: z.string().nullable(),
  /** Provider's own average (e.g. TMDB vote_average scaled 0..100), if any. */
  providerRating: z.number().min(0).max(100).nullable(),
  /** Aggregate of Cinelog users' ratings for this media, 0..100, or null. */
  communityRating: z.number().min(0).max(100).nullable(),
  userState: UserMediaState,
});
export type MediaDetail = z.infer<typeof MediaDetail>;
