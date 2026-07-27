import { z } from 'zod';
import { MediaType } from './enums.js';
import { SearchResult } from './media.js';

export const DiscoverSectionKey = z.enum([
  'TRENDING_MOVIES',
  'TRENDING_SHOWS',
  'POPULAR',
  'NEW_AND_UPCOMING',
  'HIGHLY_RATED',
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

/** Sorts available when browsing the provider's whole catalog (the Films page). */
export const BrowseSort = z.enum([
  'POPULARITY',
  'RATING',
  'RELEASE_DATE',
  'TITLE',
  'CINELOG_RATING',
]);
export type BrowseSort = z.infer<typeof BrowseSort>;

/** GET /discovery/browse — the Films browse page. Defaults to the provider
 *  catalog so the grid is populated from the first visit; `source=CINELOG`
 *  restricts to titles this instance's members have actually rated. */
export const BrowseQuery = z.object({
  type: z.enum(['MOVIE', 'TV']).optional().default('MOVIE'),
  source: z.enum(['PROVIDER', 'CINELOG']).optional().default('PROVIDER'),
  genre: z.string().optional(),
  decade: z.coerce.number().int().optional(),
  year: z.coerce.number().int().optional(),
  minRating: z.coerce.number().min(0).max(100).optional(),
  sort: BrowseSort.optional().default('POPULARITY'),
  page: z.coerce.number().int().min(1).max(500).optional().default(1),
});
export type BrowseQuery = z.infer<typeof BrowseQuery>;

export const BrowseResponse = z.object({
  items: z.array(DiscoverFilterItem),
  page: z.number().int(),
  hasMore: z.boolean(),
  source: z.enum(['PROVIDER', 'CINELOG']),
});
export type BrowseResponse = z.infer<typeof BrowseResponse>;

/** Genres offered in the browse filter. Kept in the contract so the web filter
 *  bar and the provider's id mapping can't drift apart. */
export const BROWSE_GENRES = [
  'Action',
  'Adventure',
  'Animation',
  'Comedy',
  'Crime',
  'Documentary',
  'Drama',
  'Family',
  'Fantasy',
  'History',
  'Horror',
  'Music',
  'Mystery',
  'Romance',
  'Science Fiction',
  'Thriller',
  'War',
  'Western',
] as const;
