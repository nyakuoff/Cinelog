import { z } from 'zod';

/**
 * Instance-wide integrations, configured by an admin.
 *
 * API keys are write-only across this boundary: they are accepted on write and
 * never returned on read, not even to an admin — a read reports only whether
 * one is set. Every call that needs a key is made by the API, so no key ever
 * reaches a browser.
 */
const baseUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === '' || /^https?:\/\//i.test(v), {
    message: 'Must start with http:// or https://',
  })
  .transform((v) => v.replace(/\/+$/, '')); // trailing slashes break path joins

const apiKey = z.string().trim().max(500);

/** ISO 3166-1 country code; streaming availability is per-region. */
const region = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, 'Must be a two-letter country code')
  .or(z.literal(''));

/** PUT /settings/integrations — admin only. */
export const UpdateIntegrationSettingsRequest = z.object({
  jellyfinUrl: baseUrl.nullable().optional(),
  /** Omit to keep the stored key; send an empty string to clear it. */
  jellyfinApiKey: apiKey.nullable().optional(),
  seerrUrl: baseUrl.nullable().optional(),
  seerrApiKey: apiKey.nullable().optional(),
  /** Region for streaming availability, e.g. US, GB, FR. */
  watchRegion: region.nullable().optional(),
});
export type UpdateIntegrationSettingsRequest = z.infer<typeof UpdateIntegrationSettingsRequest>;

/** GET /settings/integrations — admin only. Keys are reported, never returned. */
export const IntegrationSettings = z.object({
  jellyfinUrl: z.string().nullable(),
  seerrUrl: z.string().nullable(),
  watchRegion: z.string().nullable(),
  hasJellyfinApiKey: z.boolean(),
  hasSeerrApiKey: z.boolean(),
});
export type IntegrationSettings = z.infer<typeof IntegrationSettings>;

/** One streaming/rental service carrying a title, as reported by TMDB. */
export const WatchProvider = z.object({
  name: z.string(),
  logoUrl: z.string().nullable(),
});
export type WatchProvider = z.infer<typeof WatchProvider>;

/**
 * How far along a Jellyseerr request is. Mirrors Overseerr's media status, with
 * NONE standing in for "no request exists".
 */
export const RequestStatus = z.enum([
  'NONE',
  'PENDING',
  'PROCESSING',
  'PARTIALLY_AVAILABLE',
  'AVAILABLE',
]);
export type RequestStatus = z.infer<typeof RequestStatus>;

/**
 * GET /media/:id/availability — everything known about where a title can be
 * watched. Assembled server-side because it needs API keys the browser must
 * never hold.
 *
 * Every field degrades independently: a Jellyfin server that's down or a
 * missing TMDB region yields a null/empty section rather than failing the whole
 * response, so the media page never breaks over an unreachable homelab service.
 */
export const MediaAvailability = z.object({
  /** Deep link to the item on the configured Jellyfin server, when present there. */
  jellyfinUrl: z.string().nullable(),
  /** Included with a subscription. */
  streaming: z.array(WatchProvider),
  rent: z.array(WatchProvider),
  buy: z.array(WatchProvider),
  /** TMDB's own "watch" page for this title in the configured region. */
  providerLink: z.string().nullable(),
  region: z.string().nullable(),
  /** Whether a Jellyseerr instance is configured and reachable for requests. */
  requestSupported: z.boolean(),
  requestStatus: RequestStatus,
});
export type MediaAvailability = z.infer<typeof MediaAvailability>;

export const RequestMediaResponse = z.object({
  requestStatus: RequestStatus,
});
export type RequestMediaResponse = z.infer<typeof RequestMediaResponse>;
