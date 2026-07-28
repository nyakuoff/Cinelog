import { z } from 'zod';

/** One selectable poster image in the "Change poster" gallery. */
export const ArtworkChoice = z.object({
  /** Raw provider URL — the value sent back when applying a choice. */
  sourceUrl: z.string(),
  /** Cinelog-proxied (cached) URL — safe to use directly as an <img> src. */
  previewUrl: z.string(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  language: z.string().nullable(),
});
export type ArtworkChoice = z.infer<typeof ArtworkChoice>;

/** GET /media/:id/poster — every poster the provider offers for this title. */
export const PosterOptionsResponse = z.object({
  mediaId: z.string(),
  posters: z.array(ArtworkChoice),
  currentPosterUrl: z.string().nullable(),
});
export type PosterOptionsResponse = z.infer<typeof PosterOptionsResponse>;

/** PUT /media/:id/poster — sets the poster for this title for every member,
 *  like a Letterboxd data correction rather than a personal preference. */
export const SetPosterRequest = z.object({
  sourceUrl: z.string(),
});
export type SetPosterRequest = z.infer<typeof SetPosterRequest>;
