import { z } from 'zod';
import { MediaType } from './enums.js';
import { SearchResult } from './media.js';

export const DiscoverSectionKey = z.enum([
  'TRENDING_MOVIES',
  'TRENDING_SHOWS',
  'POPULAR',
  'NEW_AND_UPCOMING',
  'HIGHLY_RATED',
  'HIDDEN_GEMS',
]);
export type DiscoverSectionKey = z.infer<typeof DiscoverSectionKey>;

/** One horizontal rail on the Discover page. `source` tells the UI whether this
 *  is Cinelog community data or pass-through provider data, so they can be
 *  visually distinguished per the product spec. */
export const DiscoverSection = z.object({
  key: DiscoverSectionKey,
  title: z.string(),
  source: z.enum(['PROVIDER', 'CINELOG']),
  items: z.array(SearchResult),
});
export type DiscoverSection = z.infer<typeof DiscoverSection>;

export const DiscoverResponse = z.object({
  sections: z.array(DiscoverSection),
});
export type DiscoverResponse = z.infer<typeof DiscoverResponse>;

export const DiscoverSortKey = z.enum([
  'POPULARITY',
  'RELEASE_DATE',
  'CINELOG_RATING',
  'RATING_COUNT',
  'RECENTLY_REVIEWED',
]);
export type DiscoverSortKey = z.infer<typeof DiscoverSortKey>;

export const DiscoverFilterQuery = z.object({
  type: MediaType.optional(),
  genre: z.string().optional(),
  decade: z.coerce.number().int().optional(),
  minRating: z.coerce.number().min(0).max(100).optional(),
  sort: DiscoverSortKey.optional().default('POPULARITY'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(60).optional().default(24),
});
export type DiscoverFilterQuery = z.infer<typeof DiscoverFilterQuery>;

export const DiscoverFilterItem = SearchResult.extend({
  communityRating: z.number().min(0).max(100).nullable(),
  ratingCount: z.number().int(),
});
export type DiscoverFilterItem = z.infer<typeof DiscoverFilterItem>;

export const DiscoverFilterResponse = z.object({
  items: z.array(DiscoverFilterItem),
  nextCursor: z.string().nullable(),
});
export type DiscoverFilterResponse = z.infer<typeof DiscoverFilterResponse>;
