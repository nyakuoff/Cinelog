import { z } from 'zod';

/**
 * One title assembled from a Letterboxd export. A full export spreads a single
 * title across several files — ratings.csv, diary.csv, watched.csv,
 * likes/films.csv, reviews.csv — so the web app unzips the archive, merges the
 * rows by title+year, and posts one record per title rather than making the
 * member import each file separately and in the right order.
 */
export const LetterboxdItem = z.object({
  name: z.string().min(1),
  year: z.number().int().nullable(),
  /** Letterboxd star rating 0.5–5, or null if the row has none. */
  rating: z.number().min(0.5).max(5).nullable(),
  /** "Watched Date" (diary/watched) or "Date" (ratings), as plain YYYY-MM-DD. */
  watchedDate: z.string().nullable().optional().default(null),
  /** Present in likes/films.csv. */
  liked: z.boolean().optional().default(false),
  /** Body from reviews.csv, when the export includes one. */
  review: z.string().nullable().optional().default(null),
  /** diary.csv marks rewatches. */
  isRewatch: z.boolean().optional().default(false),
  /** reviews.csv flags spoilers. */
  isSpoiler: z.boolean().optional().default(false),
});
export type LetterboxdItem = z.infer<typeof LetterboxdItem>;

export const ImportMode = z.enum(['watched', 'watchlist']);
export type ImportMode = z.infer<typeof ImportMode>;

export const LetterboxdImportRequest = z.object({
  mode: ImportMode,
  items: z.array(LetterboxdItem).min(1).max(5000),
  /** Watchlist titles, carried alongside so a whole-ZIP import is one call. */
  watchlistItems: z.array(LetterboxdItem).max(5000).optional().default([]),
});
export type LetterboxdImportRequest = z.infer<typeof LetterboxdImportRequest>;

export const ImportSummary = z.object({
  total: z.number().int(),
  imported: z.number().int(),
  failed: z.number().int(),
  /** Titles that couldn't be matched to a provider entry. */
  failures: z.array(z.string()),
  /** What the import actually wrote, so the result can be trusted. */
  ratingsImported: z.number().int().optional().default(0),
  diaryEntriesImported: z.number().int().optional().default(0),
  likesImported: z.number().int().optional().default(0),
  reviewsImported: z.number().int().optional().default(0),
  watchlistImported: z.number().int().optional().default(0),
});
export type ImportSummary = z.infer<typeof ImportSummary>;
