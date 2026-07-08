import { z } from 'zod';

export const EpisodeItem = z.object({
  id: z.string(),
  episodeNumber: z.number().int(),
  name: z.string().nullable(),
  overview: z.string().nullable(),
  airDate: z.string().nullable(),
  stillUrl: z.string().nullable(),
  runtime: z.number().int().nullable(),
  /** The requesting user's rating, normalized 0..100, or null. */
  rating: z.number().min(0).max(100).nullable(),
});
export type EpisodeItem = z.infer<typeof EpisodeItem>;

export const SeasonWithEpisodes = z.object({
  seasonNumber: z.number().int(),
  name: z.string().nullable(),
  posterUrl: z.string().nullable(),
  airDate: z.string().nullable(),
  episodeCount: z.number().int(),
  /** Mean of the user's episode ratings in this season (0..100), or null. */
  averageRating: z.number().min(0).max(100).nullable(),
  ratedCount: z.number().int(),
  episodes: z.array(EpisodeItem),
});
export type SeasonWithEpisodes = z.infer<typeof SeasonWithEpisodes>;

export const EpisodesResponse = z.object({
  mediaId: z.string(),
  seasons: z.array(SeasonWithEpisodes),
  /** Mean of season averages (seasons with ≥1 rated episode), 0..100, or null. */
  showAverage: z.number().min(0).max(100).nullable(),
  totalRated: z.number().int(),
});
export type EpisodesResponse = z.infer<typeof EpisodesResponse>;

export const SetEpisodeRatingRequest = z.object({
  value: z.number().min(0).max(100).nullable(),
});
export type SetEpisodeRatingRequest = z.infer<typeof SetEpisodeRatingRequest>;

/** Returned after rating an episode, with freshly recomputed averages. */
export const EpisodeRatingResponse = z.object({
  episodeId: z.string(),
  seasonNumber: z.number().int(),
  value: z.number().min(0).max(100).nullable(),
  seasonAverage: z.number().min(0).max(100).nullable(),
  showAverage: z.number().min(0).max(100).nullable(),
});
export type EpisodeRatingResponse = z.infer<typeof EpisodeRatingResponse>;
