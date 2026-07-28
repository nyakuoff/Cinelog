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

/** GET /media/:id/poster — every poster the provider offers for this title,
 *  plus which one is currently effective for the requesting member (their
 *  own override, or the shared default). Posters are a per-user preference:
 *  the choice only changes what that member (and anyone browsing their
 *  profile/library) sees — never the title globally. */
export const PosterOptionsResponse = z.object({
  mediaId: z.string(),
  posters: z.array(ArtworkChoice),
  currentPosterUrl: z.string().nullable(),
  hasOverride: z.boolean(),
});
export type PosterOptionsResponse = z.infer<typeof PosterOptionsResponse>;

/** PUT /media/:id/poster — sets (or, when sourceUrl is null, clears) the
 *  caller's own poster override for this title. */
export const SetPosterRequest = z.object({
  sourceUrl: z.string().nullable(),
});
export type SetPosterRequest = z.infer<typeof SetPosterRequest>;
