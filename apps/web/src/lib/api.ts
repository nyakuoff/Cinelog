import type {
  ActivityFeedResponse,
  AdminCreateUserRequest,
  AdminUpdateCastRequest,
  AdminUpdateUserRequest,
  AdminUser,
  AdminUserListResponse,
  ArtworkKind,
  ArtworkOptionsResponse,
  AuthResponse,
  BackupData,
  BackupImportResult,
  BrowseQuery,
  BrowseResponse,
  ChangePasswordRequest,
  DiscoverFilterQuery,
  DiscoverFilterResponse,
  DiscoverResponse,
  AddListItemRequest,
  CreateListCommentRequest,
  CreateListRequest,
  EpisodeRatingResponse,
  FollowStateResponse,
  ListBrowseQuery,
  ListComment,
  ListCommentListResponse,
  ListDetail,
  ListListResponse,
  ReorderListRequest,
  UpdateListRequest,
  MemberListQuery,
  MemberListResponse,
  EpisodesResponse,
  ImportSummary,
  IntegrationSettings,
  MediaAvailability,
  RequestMediaResponse,
  UpdateIntegrationSettingsRequest,
  LetterboxdImportRequest,
  LibraryResponse,
  LoginRequest,
  MarkWatchedRequest,
  FavoriteSlot,
  FriendRatingsResponse,
  MediaDetail,
  MediaRef,
  ProfileDiaryResponse,
  ProfileWatchedResponse,
  ProfileWatchlistResponse,
  PublicProfile,
  UserReviewListResponse,
  CreateReviewCommentRequest,
  CreateReviewRequest,
  RatingResponse,
  RegisterRequest,
  RematchRequest,
  Review,
  ReviewComment,
  ReviewCommentListResponse,
  ReviewListResponse,
  ReviewSort,
  PersonDetail,
  SearchResponse,
  SetupRequest,
  SetupStatus,
  TrackingResponse,
  TrackingStatus,
  UpdateFavoritesRequest,
  UpdateProfileRequest,
  UpdateReviewCommentRequest,
  UpdateReviewRequest,
  UpdateWatchEntryRequest,
  UserPublic,
} from '@cinelog/contracts';

/** Same-origin: dev proxies /api to the API; prod serves both behind one host. */
const BASE = '/api';

// Access token lives in memory only; the refresh token is an httpOnly cookie,
// so a page reload re-establishes the session via /auth/refresh.
let accessToken: string | null = null;
export function setAccessToken(token: string | null): void {
  accessToken = token;
}
export function getAccessToken(): string | null {
  return accessToken;
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function parseError(res: Response): Promise<never> {
  let message = res.statusText;
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (body.message) {
      message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    }
  } catch {
    /* non-JSON error body */
  }
  throw new ApiError(res.status, message);
}

async function raw(
  method: string,
  path: string,
  body?: unknown,
  retry = true,
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const res = await fetch(BASE + path, {
    method,
    headers,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Transparently refresh the access token once on expiry, then retry.
  if (res.status === 401 && retry && path !== '/auth/refresh') {
    const refreshed = await tryRefresh();
    if (refreshed) return raw(method, path, body, false);
  }
  return res;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await raw(method, path, body);
  if (!res.ok) await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function uploadRaw(path: string, file: File, retry = true): Promise<Response> {
  const headers: Record<string, string> = {};
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(BASE + path, {
    method: 'POST',
    headers, // no Content-Type — the browser sets the multipart boundary itself
    credentials: 'include',
    body: form,
  });

  if (res.status === 401 && retry) {
    const refreshed = await tryRefresh();
    if (refreshed) return uploadRaw(path, file, false);
  }
  return res;
}

async function uploadImage(path: string, file: File): Promise<UserPublic> {
  const res = await uploadRaw(path, file);
  if (!res.ok) await parseError(res);
  return (await res.json()) as UserPublic;
}

/** Serialize a partial query object, dropping empty/undefined values. */
function toQuery(query: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return false;
    const data = (await res.json()) as AuthResponse;
    accessToken = data.tokens.accessToken;
    return true;
  } catch {
    return false;
  }
}

export const api = {
  // -- auth ------------------------------------------------------------------
  getSetupStatus: () => request<SetupStatus>('GET', '/auth/status'),
  setup: (dto: SetupRequest) => request<AuthResponse>('POST', '/auth/setup', dto),
  register: (dto: RegisterRequest) => request<AuthResponse>('POST', '/auth/register', dto),
  login: (dto: LoginRequest) => request<AuthResponse>('POST', '/auth/login', dto),
  logout: () => request<void>('POST', '/auth/logout'),
  refresh: () => request<AuthResponse>('POST', '/auth/refresh'),
  me: () => request<UserPublic>('GET', '/users/me'),

  // -- profile -----------------------------------------------------------------
  updateProfile: (dto: UpdateProfileRequest) => request<UserPublic>('PATCH', '/users/me', dto),
  changePassword: (dto: ChangePasswordRequest) =>
    request<void>('PUT', '/users/me/password', dto),
  uploadAvatar: (file: File) => uploadImage('/users/me/avatar', file),
  removeAvatar: () => request<UserPublic>('DELETE', '/users/me/avatar'),
  uploadBanner: (file: File) => uploadImage('/users/me/banner', file),
  removeBanner: () => request<UserPublic>('DELETE', '/users/me/banner'),

  // -- public profiles --------------------------------------------------------
  getPublicProfile: (username: string) =>
    request<PublicProfile>('GET', `/users/${encodeURIComponent(username)}`),
  updateFavorites: (dto: UpdateFavoritesRequest) =>
    request<{ favoriteFilms: FavoriteSlot[]; favoriteShows: FavoriteSlot[] }>(
      'PATCH',
      '/users/me/favorites',
      dto,
    ),
  getProfileDiary: (username: string) =>
    request<ProfileDiaryResponse>('GET', `/users/${encodeURIComponent(username)}/diary`),
  getProfileWatchlist: (username: string) =>
    request<ProfileWatchlistResponse>('GET', `/users/${encodeURIComponent(username)}/watchlist`),
  getProfileReviews: (username: string) =>
    request<UserReviewListResponse>('GET', `/users/${encodeURIComponent(username)}/reviews`),
  getProfileWatched: (username: string) =>
    request<ProfileWatchedResponse>('GET', `/users/${encodeURIComponent(username)}/watched`),

  // -- social graph -------------------------------------------------------------
  getMembers: (query: Partial<MemberListQuery>) =>
    request<MemberListResponse>('GET', `/members${toQuery(query)}`),
  getFollowers: (username: string, cursor?: string) =>
    request<MemberListResponse>(
      'GET',
      `/users/${encodeURIComponent(username)}/followers${toQuery({ cursor })}`,
    ),
  getFollowing: (username: string, cursor?: string) =>
    request<MemberListResponse>(
      'GET',
      `/users/${encodeURIComponent(username)}/following${toQuery({ cursor })}`,
    ),
  follow: (username: string) =>
    request<FollowStateResponse>('POST', `/users/${encodeURIComponent(username)}/follow`),
  unfollow: (username: string) =>
    request<FollowStateResponse>('DELETE', `/users/${encodeURIComponent(username)}/follow`),
  blockUser: (username: string) =>
    request<void>('POST', `/users/${encodeURIComponent(username)}/block`),
  unblockUser: (username: string) =>
    request<void>('DELETE', `/users/${encodeURIComponent(username)}/block`),
  getBlocked: () => request<MemberListResponse>('GET', '/blocked'),
  getActivity: (
    scope: 'FOLLOWING' | 'EVERYONE',
    opts: { cursor?: string; limit?: number; types?: string[] } = {},
  ) =>
    request<ActivityFeedResponse>(
      'GET',
      `/activity${toQuery({
        scope,
        cursor: opts.cursor,
        limit: opts.limit,
        types: opts.types?.join(','),
      })}`,
    ),

  // -- instance settings ---------------------------------------------------------
  getIntegrations: () => request<IntegrationSettings>('GET', '/settings/integrations'),
  updateIntegrations: (dto: UpdateIntegrationSettingsRequest) =>
    request<IntegrationSettings>('PUT', '/settings/integrations', dto),
  getAvailability: (mediaId: string) =>
    request<MediaAvailability>('GET', `/media/${mediaId}/availability`),
  requestMedia: (mediaId: string) =>
    request<RequestMediaResponse>('POST', `/media/${mediaId}/request`),

  // -- lists ---------------------------------------------------------------------
  browseLists: (query: Partial<ListBrowseQuery>) =>
    request<ListListResponse>('GET', `/lists${toQuery(query)}`),
  getUserLists: (username: string) =>
    request<ListListResponse>('GET', `/users/${encodeURIComponent(username)}/lists`),
  getList: (id: string) => request<ListDetail>('GET', `/lists/${id}`),
  createList: (dto: CreateListRequest) => request<ListDetail>('POST', '/lists', dto),
  updateList: (id: string, dto: UpdateListRequest) =>
    request<ListDetail>('PATCH', `/lists/${id}`, dto),
  deleteList: (id: string) => request<void>('DELETE', `/lists/${id}`),
  addListItem: (id: string, dto: AddListItemRequest) =>
    request<ListDetail>('POST', `/lists/${id}/items`, dto),
  updateListItem: (id: string, entryId: string, note: string | null) =>
    request<ListDetail>('PATCH', `/lists/${id}/items/${entryId}`, { note }),
  removeListItem: (id: string, entryId: string) =>
    request<ListDetail>('DELETE', `/lists/${id}/items/${entryId}`),
  reorderList: (id: string, dto: ReorderListRequest) =>
    request<ListDetail>('PUT', `/lists/${id}/order`, dto),
  likeList: (id: string) => request<void>('POST', `/lists/${id}/like`),
  unlikeList: (id: string) => request<void>('DELETE', `/lists/${id}/like`),
  getListComments: (id: string) =>
    request<ListCommentListResponse>('GET', `/lists/${id}/comments`),
  addListComment: (id: string, dto: CreateListCommentRequest) =>
    request<ListComment>('POST', `/lists/${id}/comments`, dto),
  deleteListComment: (id: string, commentId: string) =>
    request<void>('DELETE', `/lists/${id}/comments/${commentId}`),
  updateWatchEntry: (entryId: string, dto: UpdateWatchEntryRequest) =>
    request<void>('PATCH', `/tracking/watch/${entryId}`, dto),
  deleteWatchEntry: (entryId: string) => request<void>('DELETE', `/tracking/watch/${entryId}`),

  // -- discovery ---------------------------------------------------------------
  getDiscover: () => request<DiscoverResponse>('GET', '/discovery'),
  getDiscoverFilter: (query: Partial<DiscoverFilterQuery>) =>
    request<DiscoverFilterResponse>('GET', `/discovery/filter${toQuery(query)}`),
  browse: (query: Partial<BrowseQuery>) =>
    request<BrowseResponse>('GET', `/discovery/browse${toQuery(query)}`),

  // -- media -----------------------------------------------------------------
  search: (q: string, type?: string) =>
    request<SearchResponse>(
      'GET',
      `/search?q=${encodeURIComponent(q)}${type ? `&type=${type}` : ''}`,
    ),
  resolveMedia: (ref: MediaRef) => request<MediaDetail>('POST', '/media/resolve', ref),
  /** `libraryOf` renders the title as it appears in that member's library,
   *  with their artwork choices applied. */
  getMedia: (id: string, libraryOf?: string) =>
    request<MediaDetail>('GET', `/media/${id}${toQuery({ libraryOf })}`),
  getSimilar: (id: string) => request<SearchResponse>('GET', `/media/${id}/similar`),
  /** A person's filmography, by provider id or — for older credits — by name. */
  getPerson: (id: string) => request<PersonDetail>('GET', `/people/${encodeURIComponent(id)}`),
  getPersonByName: (name: string) =>
    request<PersonDetail>('GET', `/people/by-name?name=${encodeURIComponent(name)}`),
  getFriendRatings: (id: string) => request<FriendRatingsResponse>('GET', `/media/${id}/friend-ratings`),
  getArtworkOptions: (mediaId: string) =>
    request<ArtworkOptionsResponse>('GET', `/media/${mediaId}/artwork`),
  setArtwork: (mediaId: string, kind: ArtworkKind, sourceUrl: string | null) =>
    request<void>('PUT', `/media/${mediaId}/artwork`, { kind, sourceUrl }),
  rematchMedia: (mediaId: string, dto: RematchRequest) =>
    request<MediaDetail>('PUT', `/media/${mediaId}/rematch`, dto),
  updateMediaCast: (mediaId: string, dto: AdminUpdateCastRequest) =>
    request<void>('PUT', `/media/${mediaId}/cast`, dto),

  // -- tracking --------------------------------------------------------------
  getLibrary: () => request<LibraryResponse>('GET', '/tracking/library'),
  setStatus: (ref: MediaRef, status: TrackingStatus | null) =>
    request<TrackingResponse>('PUT', '/tracking/status', { ...ref, status }),
  setFavorite: (ref: MediaRef, value: boolean) =>
    request<TrackingResponse>('PUT', '/tracking/favorite', { ...ref, value }),
  setWatchlist: (ref: MediaRef, value: boolean) =>
    request<TrackingResponse>('PUT', '/tracking/watchlist', { ...ref, value }),
  markWatched: (req: MarkWatchedRequest) =>
    request<TrackingResponse>('POST', '/tracking/watch', req),
  unmarkWatched: (ref: MediaRef) => request<TrackingResponse>('DELETE', '/tracking/watch', ref),

  // -- reviews -----------------------------------------------------------------
  createReview: (mediaId: string, dto: CreateReviewRequest) =>
    request<Review>('POST', `/media/${mediaId}/reviews`, dto),
  getReviews: (mediaId: string, sort: ReviewSort = 'POPULAR', cursor?: string) =>
    request<ReviewListResponse>(
      'GET',
      `/media/${mediaId}/reviews?sort=${sort}${cursor ? `&cursor=${cursor}` : ''}`,
    ),
  getReview: (reviewId: string) => request<Review>('GET', `/reviews/${reviewId}`),
  updateReview: (reviewId: string, dto: UpdateReviewRequest) =>
    request<Review>('PATCH', `/reviews/${reviewId}`, dto),
  deleteReview: (reviewId: string) => request<void>('DELETE', `/reviews/${reviewId}`),
  likeReview: (reviewId: string) => request<void>('POST', `/reviews/${reviewId}/like`),
  unlikeReview: (reviewId: string) => request<void>('DELETE', `/reviews/${reviewId}/like`),
  getReviewComments: (reviewId: string, cursor?: string) =>
    request<ReviewCommentListResponse>(
      'GET',
      `/reviews/${reviewId}/comments${cursor ? `?cursor=${cursor}` : ''}`,
    ),
  addReviewComment: (reviewId: string, dto: CreateReviewCommentRequest) =>
    request<ReviewComment>('POST', `/reviews/${reviewId}/comments`, dto),
  updateReviewComment: (reviewId: string, commentId: string, dto: UpdateReviewCommentRequest) =>
    request<ReviewComment>('PATCH', `/reviews/${reviewId}/comments/${commentId}`, dto),
  deleteReviewComment: (reviewId: string, commentId: string) =>
    request<void>('DELETE', `/reviews/${reviewId}/comments/${commentId}`),

  // -- ratings ---------------------------------------------------------------
  setRating: (ref: MediaRef, value: number | null) =>
    request<RatingResponse>('PUT', '/ratings', { ...ref, value }),

  // -- episodes --------------------------------------------------------------
  getEpisodes: (mediaId: string) =>
    request<EpisodesResponse>('GET', `/media/${mediaId}/episodes`),
  rateEpisode: (episodeId: string, value: number | null) =>
    request<EpisodeRatingResponse>('PUT', `/episodes/${episodeId}/rating`, { value }),
  clearSeasonRatings: (mediaId: string, seasonNumber: number) =>
    request<void>('DELETE', `/media/${mediaId}/seasons/${seasonNumber}/ratings`),

  // -- import ----------------------------------------------------------------
  importLetterboxd: (req: LetterboxdImportRequest) =>
    request<ImportSummary>('POST', '/import/letterboxd', req),

  // -- backup ----------------------------------------------------------------
  exportBackup: () => request<BackupData>('GET', '/backup/export'),
  importBackup: (data: BackupData) => request<BackupImportResult>('POST', '/backup/import', data),

  // -- admin -----------------------------------------------------------------
  adminListUsers: () => request<AdminUserListResponse>('GET', '/admin/users'),
  adminCreateUser: (dto: AdminCreateUserRequest) =>
    request<AdminUser>('POST', '/admin/users', dto),
  adminUpdateUser: (id: string, dto: AdminUpdateUserRequest) =>
    request<AdminUser>('PATCH', `/admin/users/${id}`, dto),
  adminDeleteUser: (id: string) => request<void>('DELETE', `/admin/users/${id}`),

  // -- letterboxd live sync ---------------------------------------------------
};

export { ApiError };
