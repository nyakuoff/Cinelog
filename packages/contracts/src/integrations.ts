import { z } from 'zod';

/**
 * Instance-wide integrations an admin points at their own services.
 *
 * These are deep links only — Cinelog stores a base URL and builds a URL from
 * it. Nothing is proxied and no API key is held, so the worst a bad value can
 * do is produce a link that 404s. That also means Cinelog cannot tell whether
 * a title is actually present in the library it links to; the Jellyfin link is
 * a search, honestly labelled as one.
 */
const baseUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === '' || /^https?:\/\//i.test(v), {
    message: 'Must start with http:// or https://',
  })
  .transform((v) => v.replace(/\/+$/, '')); // trailing slashes break path joins

export const IntegrationSettings = z.object({
  /** Base URL of a Jellyfin server, e.g. https://jellyfin.example.com */
  jellyfinUrl: baseUrl.nullable().optional().default(null),
  /** Base URL of a Jellyseerr / Overseerr instance. */
  seerrUrl: baseUrl.nullable().optional().default(null),
});
export type IntegrationSettings = z.infer<typeof IntegrationSettings>;

export const UpdateIntegrationSettingsRequest = IntegrationSettings;
export type UpdateIntegrationSettingsRequest = z.infer<typeof UpdateIntegrationSettingsRequest>;
