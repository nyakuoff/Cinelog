import type { LibraryItem } from '@cinelog/contracts';

/** Letterboxd-style ordering options for a poster grid. */
export type SortKey =
  | 'added'
  | 'rating-desc'
  | 'rating-asc'
  | 'year-desc'
  | 'year-asc'
  | 'title-asc';

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'added', label: 'Recently added' },
  { key: 'rating-desc', label: 'Highest rated' },
  { key: 'rating-asc', label: 'Lowest rated' },
  { key: 'year-desc', label: 'Release date (newest)' },
  { key: 'year-asc', label: 'Release date (oldest)' },
  { key: 'title-asc', label: 'Title (A–Z)' },
];

/** Unrated / undated items always sink to the bottom regardless of direction. */
function nullableCompare(
  a: number | null,
  b: number | null,
  dir: 1 | -1,
): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return dir * (a - b);
}

/** Returns a new sorted array; `added` preserves the server's recency order. */
export function sortLibrary(items: LibraryItem[], key: SortKey): LibraryItem[] {
  const arr = [...items];
  switch (key) {
    case 'added':
      return arr;
    case 'title-asc':
      return arr.sort((a, b) => a.title.localeCompare(b.title));
    case 'year-desc':
      return arr.sort((a, b) => nullableCompare(a.year, b.year, -1));
    case 'year-asc':
      return arr.sort((a, b) => nullableCompare(a.year, b.year, 1));
    case 'rating-desc':
      return arr.sort((a, b) => nullableCompare(a.rating, b.rating, -1));
    case 'rating-asc':
      return arr.sort((a, b) => nullableCompare(a.rating, b.rating, 1));
  }
}
