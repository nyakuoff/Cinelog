/**
 * Map a normalized rating (0..100) to a heat color for the episode grid.
 * A diverging ramp built from Cinelog's own accents — rose (low) → amber (mid)
 * → cyan/green (high) — so it reads intuitively (warm = worse, cool = better)
 * while staying on-brand rather than a generic rainbow.
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function ratingColor(normalized: number): { bg: string; fg: string } {
  const t = Math.max(0, Math.min(1, normalized / 100));
  let h: number;
  let s: number;
  let l: number;
  if (t < 0.5) {
    const u = t / 0.5; // rose (-12°) → amber (40°)
    h = lerp(-12, 40, u);
    s = lerp(80, 95, u);
    l = lerp(58, 56, u);
  } else {
    const u = (t - 0.5) / 0.5; // amber (40°) → cyan (184°), through green
    h = lerp(40, 184, u);
    s = lerp(95, 62, u);
    l = lerp(56, 54, u);
  }
  const hue = (h + 360) % 360;
  return { bg: `hsl(${hue.toFixed(0)} ${s.toFixed(0)}% ${l.toFixed(0)}%)`, fg: '#141018' };
}

/** Display a normalized value on the 0..10 scale (trims trailing .0). */
export function to10(normalized: number, decimals = 1): string {
  const v = normalized / 10;
  const s = v.toFixed(decimals);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}
