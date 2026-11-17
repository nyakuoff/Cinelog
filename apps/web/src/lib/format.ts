/**
 * How the archive types a date: `17 Nov 2026`. One format everywhere, set in
 * `font-data` by the caller (see `DateText` in components/lb).
 *
 * Watch dates are date-only — the server stores them at 12:00 UTC — and so are
 * bare `YYYY-MM-DD` strings (release, air and birth dates). Both are read as
 * UTC calendar dates so they can never slide a day in the viewer's timezone.
 * Pass `dateOnly` for a full ISO instant that is really a date (a watch date).
 */
export function formatDate(iso: string, opts: { dateOnly?: boolean } = {}): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const utc = opts.dateOnly || /^\d{4}-\d{2}-\d{2}$/.test(iso);
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(utc ? { timeZone: 'UTC' } : {}),
  });
}

/** Today as YYYY-MM-DD in the viewer's own timezone (toISOString is UTC). */
export function localDateString(d = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** `November 2026` — for "joined" lines and (later) diary month headings. */
export function formatMonth(iso: string, opts: { dateOnly?: boolean } = {}): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    ...(opts.dateOnly ? { timeZone: 'UTC' } : {}),
  });
}

/** Compact relative timestamp for feeds; falls back to the date past a month. */
export function relativeTime(iso: string): string {
  const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

/** `3 titles` / `1 title`. */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Minimum-rating filter choices (normalized), phrased once for every browse
 * surface. Both scales are named because a filter spans films and shows.
 */
export const MIN_RATING_OPTIONS: { value: number; label: string }[] = [
  { value: 60, label: '★ 3+ (6+/10)' },
  { value: 70, label: '★ 3.5+ (7+/10)' },
  { value: 80, label: '★ 4+ (8+/10)' },
];

/** Decade filter choices, newest first: 2020, 2010, … */
export function decadeOptions(from = 1900): number[] {
  const out: number[] = [];
  for (let d = Math.floor(new Date().getFullYear() / 10) * 10; d >= from; d -= 10) out.push(d);
  return out;
}
