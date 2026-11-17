/** Shared so a poster hover can warm the chunk the lazy route will ask for. */
export const loadMediaDetail = (): Promise<typeof import('../pages/MediaDetailPage')> =>
  import('../pages/MediaDetailPage');
