import type {
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
  ChangePasswordRequest,
  ConnectLetterboxdRequest,
  EpisodeRatingResponse,
  EpisodesResponse,
  ImportSummary,
  LetterboxdImportRequest,
  LetterboxdSyncResult,
  LetterboxdSyncStatus,
  LibraryResponse,
  LoginRequest,
  MarkWatchedRequest,
  MediaDetail,
  MediaRef,
  RatingResponse,
  RegisterRequest,
  RematchRequest,
  SearchResponse,
  SetupRequest,
  SetupStatus,
  TrackingResponse,
  TrackingStatus,
  UpdateProfileRequest,
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

  // -- media -----------------------------------------------------------------
  search: (q: string, type?: string) =>
    request<SearchResponse>(
      'GET',
      `/search?q=${encodeURIComponent(q)}${type ? `&type=${type}` : ''}`,
    ),
  resolveMedia: (ref: MediaRef) => request<MediaDetail>('POST', '/media/resolve', ref),
  getMedia: (id: string) => request<MediaDetail>('GET', `/media/${id}`),
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
  getLetterboxdStatus: () => request<LetterboxdSyncStatus>('GET', '/import/letterboxd/status'),
  connectLetterboxd: (dto: ConnectLetterboxdRequest) =>
    request<LetterboxdSyncStatus>('PUT', '/import/letterboxd/connect', dto),
  disconnectLetterboxd: () =>
    request<LetterboxdSyncStatus>('DELETE', '/import/letterboxd/connect'),
  syncLetterboxdNow: () => request<LetterboxdSyncResult>('POST', '/import/letterboxd/sync'),
};

export { ApiError };
