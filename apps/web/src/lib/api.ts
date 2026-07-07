import type {
  AuthResponse,
  LibraryResponse,
  LoginRequest,
  MarkWatchedRequest,
  MediaDetail,
  MediaRef,
  RatingResponse,
  RegisterRequest,
  SearchResponse,
  SetupRequest,
  SetupStatus,
  TrackingResponse,
  TrackingStatus,
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

  // -- media -----------------------------------------------------------------
  search: (q: string, type?: string) =>
    request<SearchResponse>(
      'GET',
      `/search?q=${encodeURIComponent(q)}${type ? `&type=${type}` : ''}`,
    ),
  resolveMedia: (ref: MediaRef) => request<MediaDetail>('POST', '/media/resolve', ref),
  getMedia: (id: string) => request<MediaDetail>('GET', `/media/${id}`),

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
};

export { ApiError };
