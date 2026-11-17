/**
 * Heat for the episode grid, from a normalized rating (0..100).
 *
 * One ink, more or less of it. These cells are your own episode ratings, so
 * they're amber — the ink that means "your mark" — laid on heavier the higher
 * you scored. (The old ramp ran rose → amber → green: two inks with other jobs
 * and one colour that isn't in the palette at all.) The number is printed in
 * every cell, so the tone only has to give the season its shape.
 */
export function ratingColor(normalized: number): { bg: string; fg: string } {
  const t = Math.max(0, Math.min(1, normalized / 100));
  const alpha = 0.14 + 0.86 * t * t;
  return {
    bg: `rgb(var(--gold) / ${alpha.toFixed(2)})`,
    fg: alpha > 0.55 ? 'rgb(var(--ink))' : 'rgb(var(--content))',
  };
}
