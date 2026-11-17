import type { MediaItem, Prisma } from '@prisma/client';

/** The MediaItem fields list/summary mappers read. Selecting just these keeps
 *  the (large) rawMetadata JSON blob out of every list query. */
export const mediaSummarySelect = {
  id: true,
  type: true,
  title: true,
  releaseDate: true,
  posterPath: true,
} as const;

export type MediaSummaryRow = Pick<MediaItem, keyof typeof mediaSummarySelect>;

/** MediaItems a member has watched: a diary entry, a rating, or COMPLETED
 *  status. The one "watched" definition (profile Watched tab, stats, lists,
 *  person credits). */
export function watchedMediaWhere(userId: string): Prisma.MediaItemWhereInput {
  return {
    OR: [
      { history: { some: { userId } } },
      { ratings: { some: { userId } } },
      { statuses: { some: { userId, status: 'COMPLETED' } } },
    ],
  };
}

