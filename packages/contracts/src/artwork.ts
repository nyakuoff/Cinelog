import { z } from 'zod';

/** Artwork kinds a user can override (logos/banners aren't pickable yet). */
export const ArtworkKind = z.enum(['POSTER', 'BACKDROP']);
export type ArtworkKind = z.infer<typeof ArtworkKind>;

/** One selectable image in the "Edit Artwork" gallery. */
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

export const ArtworkOptionsResponse = z.object({
  mediaId: z.string(),
  posters: z.array(ArtworkChoice),
  backdrops: z.array(ArtworkChoice),
  /** Currently effective source URL for each kind (override, or the default). */
  selectedPoster: z.string().nullable(),
  selectedBackdrop: z.string().nullable(),
  hasPosterOverride: z.boolean(),
  hasBackdropOverride: z.boolean(),
});
export type ArtworkOptionsResponse = z.infer<typeof ArtworkOptionsResponse>;

/** sourceUrl: null resets to the provider default. */
export const SetArtworkRequest = z.object({
  kind: ArtworkKind,
  sourceUrl: z.string().nullable(),
});
export type SetArtworkRequest = z.infer<typeof SetArtworkRequest>;
