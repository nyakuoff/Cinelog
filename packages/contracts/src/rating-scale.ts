import type { MediaType, RatingScale } from './enums.js';

/** Display metadata for each configurable rating scale. */
export interface RatingScaleConfig {
  /** Max value in the scale's own units (e.g. 5 stars, 10, 100). */
  max: number;
  /** Smallest increment the user can pick, in the scale's own units. */
  step: number;
  /** How many decimal places to show. */
  decimals: number;
  /** True if this scale is presented as stars rather than a number. */
  isStars: boolean;
}

export const RATING_SCALES: Record<RatingScale, RatingScaleConfig> = {
  FIVE_STAR: { max: 5, step: 1, decimals: 0, isStars: true },
  FIVE_STAR_HALF: { max: 5, step: 0.5, decimals: 1, isStars: true },
  // IMDB-style: ten whole stars.
  TEN: { max: 10, step: 1, decimals: 0, isStars: true },
  HUNDRED: { max: 100, step: 1, decimals: 0, isStars: false },
};

/** Convert a normalized 0..100 value into the given scale's display units. */
export function fromNormalized(value: number, scale: RatingScale): number {
  const cfg = RATING_SCALES[scale];
  const raw = (value / 100) * cfg.max;
  const snapped = Math.round(raw / cfg.step) * cfg.step;
  return Number(snapped.toFixed(cfg.decimals));
}

/** Convert a value in a scale's display units back to normalized 0..100. */
export function toNormalized(value: number, scale: RatingScale): number {
  const cfg = RATING_SCALES[scale];
  const normalized = (value / cfg.max) * 100;
  return Math.max(0, Math.min(100, normalized));
}

/**
 * Rating scale by media type: standalone works (movies, specials) use a
 * 5-star scale; episodic works (TV, anime, etc.) use 10 so episodes have the
 * granularity to average cleanly.
 */
export function scaleForMediaType(type: MediaType): RatingScale {
  return type === 'MOVIE' || type === 'SPECIAL' ? 'FIVE_STAR_HALF' : 'TEN';
}
