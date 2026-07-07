import type { UserRole } from '@cinelog/contracts';

/** Shape of the decoded JWT access token payload / request.user. */
export interface AuthUser {
  sub: string; // user id
  username: string;
  role: UserRole;
}

/** JWT payload as signed (adds standard claims at runtime). */
export type AccessTokenPayload = AuthUser;
