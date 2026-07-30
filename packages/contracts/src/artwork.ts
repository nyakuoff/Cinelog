import { z } from 'zod';

/** Which image a choice applies to. */
export const ArtworkKind = z.enum(['POSTER', 'BACKDROP']);
export type ArtworkKind = z.infer<typeof ArtworkKind>;

/** One selectable image in the artwork picker. */
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

/**
 * GET /media/:id/artwork — every image the provider offers for this title,
 * plus which one is currently effective for the requesting member.
 *
 * Overrides are per-member and library-scoped: a choice changes how the title
 * looks in that member's library, and to anyone browsing that member's
 * profile, but never on the title's own page for anyone.
 */
export const ArtworkOptionsResponse = z.object({
  mediaId: z.string(),
  posters: z.array(ArtworkChoice),
  backdrops: z.array(ArtworkChoice),
  /** The member's effective choice, falling back to the provider default. */
  currentPosterUrl: z.string().nullable(),
  currentBackdropUrl: z.string().nullable(),
  hasPosterOverride: z.boolean(),
  hasBackdropOverride: z.boolean(),
});
export type ArtworkOptionsResponse = z.infer<typeof ArtworkOptionsResponse>;

/** PUT /media/:id/artwork — `sourceUrl: null` clears the override. */
export const SetArtworkRequest = z.object({
  kind: ArtworkKind,
  sourceUrl: z.string().nullable(),
});
export type SetArtworkRequest = z.infer<typeof SetArtworkRequest>;
