import { z } from 'zod';
import { MediaType, TrackingStatus } from './enums.js';
import { UserMediaState } from './media.js';

/**
 * Resolve a media reference. The web app may hold either a cached Cinelog id
 * (from a prior open) or just the provider coordinates (from a fresh search
 * result). Tracking/rating endpoints accept either and resolve to a MediaItem.
 */
export const MediaRef = z
  .object({
    mediaId: z.string().optional(),
    provider: z.enum(['tmdb', 'tvdb', 'anilist']).optional(),
    externalId: z.string().optional(),
    type: MediaType.optional(),
  })
  .refine((v) => !!v.mediaId || (!!v.provider && !!v.externalId && !!v.type), {
    message: 'Provide either mediaId, or provider + externalId + type',
  });
export type MediaRef = z.infer<typeof MediaRef>;

/** PUT /tracking/status — set or clear (null) the tracking status. */
export const SetStatusRequest = MediaRef.and(
  z.object({ status: TrackingStatus.nullable() }),
);
export type SetStatusRequest = z.infer<typeof SetStatusRequest>;

export const SetFlagRequest = MediaRef.and(z.object({ value: z.boolean() }));
export type SetFlagRequest = z.infer<typeof SetFlagRequest>;

/** POST /tracking/watch — record a watch (or rewatch) event. */
export const MarkWatchedRequest = MediaRef.and(
  z.object({
    watchedAt: z.string().datetime().optional(),
    isRewatch: z.boolean().optional(),
  }),
);
export type MarkWatchedRequest = z.infer<typeof MarkWatchedRequest>;

/** Returned by every tracking mutation so the client can update in place. */
export const TrackingResponse = z.object({
  mediaId: z.string(),
  userState: UserMediaState,
});
export type TrackingResponse = z.infer<typeof TrackingResponse>;

/** GET /tracking/library — the user's tracked items (for the home page). */
export const LibraryItem = z.object({
  id: z.string(),
  type: MediaType,
  title: z.string(),
  year: z.number().int().nullable(),
  posterUrl: z.string().nullable(),
  status: TrackingStatus.nullable(),
  isFavorite: z.boolean(),
  isWatchlisted: z.boolean(),
  rating: z.number().min(0).max(100).nullable(),
});
export type LibraryItem = z.infer<typeof LibraryItem>;

export const LibraryResponse = z.object({
  items: z.array(LibraryItem),
});
export type LibraryResponse = z.infer<typeof LibraryResponse>;
