import type { QueryClient } from '@tanstack/react-query';

/**
 * Everything that can show the viewer's own watch/rating/like/watchlist state.
 * Call after any tracking or rating mutation so no surface keeps a stale copy.
 *
 * Profile keys are all `['profile', username, ...]`, so the bare prefix covers
 * the header stats and every profile tab.
 */
export function invalidateUserMedia(qc: QueryClient, mediaId?: string): void {
  const keys: unknown[][] = [['library'], ['activity'], ['profile'], ['home']];
  if (mediaId) {
    keys.push(['media', mediaId], ['reviews', mediaId], ['friend-ratings', mediaId]);
  }
  for (const queryKey of keys) void qc.invalidateQueries({ queryKey });
}
