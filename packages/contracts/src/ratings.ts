import { z } from 'zod';
import { MediaRef } from './tracking.js';

/**
 * Ratings are stored normalized 0..100 regardless of the user's display scale,
 * so switching scales never loses precision. The client converts to/from the
 * user's chosen scale for input and display.
 */
export const SetRatingRequest = MediaRef.and(
  z.object({
    /** Normalized 0..100, or null to clear the rating. */
    value: z.number().min(0).max(100).nullable(),
  }),
);
export type SetRatingRequest = z.infer<typeof SetRatingRequest>;

export const RatingResponse = z.object({
  mediaId: z.string(),
  value: z.number().min(0).max(100).nullable(),
  communityRating: z.number().min(0).max(100).nullable(),
});
export type RatingResponse = z.infer<typeof RatingResponse>;
