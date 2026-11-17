/**
 * Parse a watch date from client/import input.
 *
 * A date-only string (`YYYY-MM-DD`, what Letterboxd exports) has no time, and
 * `new Date('YYYY-MM-DD')` is UTC midnight — which renders as the previous
 * day anywhere west of UTC. Date-only values are pinned to 12:00 UTC instead,
 * which keeps the same calendar day from UTC-11 to UTC+11. Full timestamps
 * pass through untouched. Returns null for empty or unparseable input.
 */
export function parseWatchDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00.000Z` : value);
  return Number.isNaN(d.getTime()) ? null : d;
}
