import { unzipSync, strFromU8 } from 'fflate';
import type { LetterboxdItem } from '@cinelog/contracts';
import { parseCsv } from './csv';

/**
 * Reads a whole Letterboxd export ZIP.
 *
 * An export spreads one film across several files — ratings.csv has the score,
 * diary.csv the watched date and rewatch flag, likes/films.csv the like,
 * reviews.csv the text — so importing them one at a time both loses
 * information and makes the order matter. This unzips in the browser and
 * merges every file into one record per film before anything is sent.
 *
 * Files are matched by suffix so the export's top-level folder (Letterboxd
 * nests everything under a dated directory) doesn't matter.
 */

export interface ParsedExport {
  items: LetterboxdItem[];
  watchlistItems: LetterboxdItem[];
  /** Which recognised files were present, for honest reporting in the UI. */
  filesFound: string[];
  /** Files in the archive that carry data Cinelog can't import yet. */
  filesSkipped: string[];
}

type Row = Record<string, string>;

function rowsOf(text: string): Row[] {
  const grid = parseCsv(text);
  const header = (grid[0] ?? []).map((h) => h.trim().toLowerCase());
  return grid.slice(1).map((cells) => {
    const row: Row = {};
    header.forEach((h, i) => {
      row[h] = (cells[i] ?? '').trim();
    });
    return row;
  });
}

/** Letterboxd URI is the only stable identity; name+year is the fallback. */
function keyOf(row: Row): string {
  const uri = row['letterboxd uri'];
  if (uri) return uri;
  return `${(row.name ?? '').toLowerCase()}::${row.year ?? ''}`;
}

function baseItem(row: Row): LetterboxdItem {
  const year = row.year ? Number.parseInt(row.year, 10) || null : null;
  return {
    name: row.name ?? '',
    year,
    rating: null,
    watchedDate: null,
    liked: false,
    review: null,
    isRewatch: false,
    isSpoiler: false,
  };
}

function parseRating(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) && n >= 0.5 && n <= 5 ? n : null;
}

function isTrue(value: string | undefined): boolean {
  return (value ?? '').toLowerCase() === 'yes' || (value ?? '').toLowerCase() === 'true';
}

export function parseLetterboxdZip(buffer: Uint8Array): ParsedExport {
  const files = unzipSync(buffer);
  const filesFound: string[] = [];
  const filesSkipped: string[] = [];

  // Suffix -> the archive entry's text, ignoring any wrapping folder.
  const find = (suffix: string): string | null => {
    const hit = Object.keys(files).find(
      (n) => n.toLowerCase().endsWith(suffix) && !n.startsWith('__MACOSX'),
    );
    if (!hit) return null;
    filesFound.push(suffix);
    return strFromU8(files[hit]!);
  };

  const merged = new Map<string, LetterboxdItem>();
  const upsert = (row: Row, apply: (item: LetterboxdItem) => void): void => {
    if (!row.name) return;
    const key = keyOf(row);
    const item = merged.get(key) ?? baseItem(row);
    apply(item);
    merged.set(key, item);
  };

  // watched.csv is the broadest "I have seen this" set, so it seeds the map.
  const watched = find('watched.csv');
  if (watched) {
    for (const row of rowsOf(watched)) {
      upsert(row, (item) => {
        item.watchedDate ??= row.date || null;
      });
    }
  }

  // ratings.csv carries the score; its Date is when it was rated, which is the
  // best available stand-in when there's no diary entry.
  const ratings = find('ratings.csv');
  if (ratings) {
    for (const row of rowsOf(ratings)) {
      upsert(row, (item) => {
        item.rating = parseRating(row.rating);
        item.watchedDate ??= row.date || null;
      });
    }
  }

  // diary.csv is the most specific: a real watched date and the rewatch flag.
  const diary = find('diary.csv');
  if (diary) {
    for (const row of rowsOf(diary)) {
      upsert(row, (item) => {
        item.watchedDate = row['watched date'] || row.date || item.watchedDate;
        item.rating = parseRating(row.rating) ?? item.rating;
        if (isTrue(row.rewatch)) item.isRewatch = true;
      });
    }
  }

  const reviews = find('reviews.csv');
  if (reviews) {
    for (const row of rowsOf(reviews)) {
      upsert(row, (item) => {
        if (row.review) item.review = row.review;
        item.watchedDate = row['watched date'] || item.watchedDate;
        item.rating = parseRating(row.rating) ?? item.rating;
        if (isTrue(row.rewatch)) item.isRewatch = true;
        if (isTrue(row['contains spoilers'])) item.isSpoiler = true;
      });
    }
  }

  const likes = find('likes/films.csv');
  if (likes) {
    for (const row of rowsOf(likes)) {
      upsert(row, (item) => {
        item.liked = true;
      });
    }
  }

  // The watchlist is a separate set — these are explicitly *not* watched.
  const watchlistItems: LetterboxdItem[] = [];
  const watchlist = find('watchlist.csv');
  if (watchlist) {
    for (const row of rowsOf(watchlist)) {
      if (row.name) watchlistItems.push(baseItem(row));
    }
  }

  // Say plainly what was left behind rather than implying a total import.
  for (const name of Object.keys(files)) {
    const lower = name.toLowerCase();
    if (lower.endsWith('/') || name.startsWith('__MACOSX')) continue;
    if (lower.endsWith('comments.csv')) filesSkipped.push('comments.csv');
    else if (lower.includes('/lists/')) filesSkipped.push('lists/');
    else if (lower.endsWith('profile.csv')) filesSkipped.push('profile.csv');
  }

  return {
    items: [...merged.values()],
    watchlistItems,
    filesFound,
    filesSkipped: [...new Set(filesSkipped)],
  };
}
