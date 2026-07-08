import { z } from 'zod';
import { ArtworkKind } from './artwork.js';
import { MediaType, ProviderId, RatingScale, TrackingStatus } from './enums.js';

/** A single watch/rewatch event in a backup. */
export const BackupWatchEvent = z.object({
  watchedAt: z.string().datetime(),
  isRewatch: z.boolean(),
});

/** A per-user artwork override in a backup. */
export const BackupArtwork = z.object({
  type: ArtworkKind,
  url: z.string(),
});

/** A per-episode rating in a backup, keyed by season/episode number so it can
 *  be re-attached after the show's episodes are re-cached on import. */
export const BackupEpisodeRating = z.object({
  seasonNumber: z.number().int(),
  episodeNumber: z.number().int(),
  value: z.number().min(0).max(100),
});

/** Everything the user tracked for one title. Media is identified by provider
 *  coordinates so it can be re-resolved on a fresh install. */
export const BackupItem = z.object({
  provider: ProviderId,
  externalId: z.string(),
  type: MediaType,
  title: z.string(),
  year: z.number().int().nullable(),
  status: TrackingStatus.nullable(),
  isFavorite: z.boolean(),
  isWatchlisted: z.boolean(),
  rewatchCount: z.number().int(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  rating: z.number().min(0).max(100).nullable(),
  watchHistory: z.array(BackupWatchEvent),
  artwork: z.array(BackupArtwork),
  episodeRatings: z.array(BackupEpisodeRating),
});
export type BackupItem = z.infer<typeof BackupItem>;

export const BackupUser = z.object({
  username: z.string(),
  bio: z.string().nullable(),
  ratingScale: RatingScale,
  letterboxdUsername: z.string().nullable(),
});

/** Full Cinelog data export — the JSON a user downloads and can re-import. */
export const BackupData = z.object({
  app: z.literal('cinelog').default('cinelog'),
  version: z.literal(1),
  exportedAt: z.string().datetime(),
  user: BackupUser,
  items: z.array(BackupItem),
});
export type BackupData = z.infer<typeof BackupData>;

export const BackupImportResult = z.object({
  itemsProcessed: z.number().int(),
  itemsImported: z.number().int(),
  ratingsImported: z.number().int(),
  watchEventsImported: z.number().int(),
  episodeRatingsImported: z.number().int(),
  failed: z.number().int(),
  failures: z.array(z.string()),
});
export type BackupImportResult = z.infer<typeof BackupImportResult>;
