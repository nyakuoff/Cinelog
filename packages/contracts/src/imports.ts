import { z } from 'zod';

/** One row parsed from a Letterboxd export CSV. */
export const LetterboxdItem = z.object({
  name: z.string().min(1),
  year: z.number().int().nullable(),
  /** Letterboxd star rating 0.5–5, or null if the row has none. */
  rating: z.number().min(0.5).max(5).nullable(),
});
export type LetterboxdItem = z.infer<typeof LetterboxdItem>;

export const ImportMode = z.enum(['watched', 'watchlist']);
export type ImportMode = z.infer<typeof ImportMode>;

export const LetterboxdImportRequest = z.object({
  mode: ImportMode,
  items: z.array(LetterboxdItem).min(1).max(2000),
});
export type LetterboxdImportRequest = z.infer<typeof LetterboxdImportRequest>;

export const ImportSummary = z.object({
  total: z.number().int(),
  imported: z.number().int(),
  failed: z.number().int(),
  /** Titles that couldn't be matched to a provider entry. */
  failures: z.array(z.string()),
});
export type ImportSummary = z.infer<typeof ImportSummary>;

// ---------------------------------------------------------------------------
// Letterboxd live sync — pulls the user's public diary RSS feed on demand.
// Letterboxd has no public write/sync API, so this is a one-way, on-request
// pull of recent activity (the RSS feed only exposes the latest ~50 entries).
// For full history, use the CSV import above.
// ---------------------------------------------------------------------------

export const ConnectLetterboxdRequest = z.object({
  username: z.string().min(1).max(50),
});
export type ConnectLetterboxdRequest = z.infer<typeof ConnectLetterboxdRequest>;

export const LetterboxdSyncStatus = z.object({
  connectedUsername: z.string().nullable(),
  lastSyncedAt: z.string().datetime().nullable(),
});
export type LetterboxdSyncStatus = z.infer<typeof LetterboxdSyncStatus>;

export const LetterboxdSyncResult = z.object({
  processed: z.number().int(),
  imported: z.number().int(),
  failed: z.number().int(),
  failures: z.array(z.string()),
});
export type LetterboxdSyncResult = z.infer<typeof LetterboxdSyncResult>;
