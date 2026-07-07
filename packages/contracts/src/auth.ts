import { z } from 'zod';
import { RatingScale, UserRole } from './enums.js';

export const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(32)
  .regex(/^[a-zA-Z0-9_.-]+$/, 'Only letters, numbers, and . _ - are allowed');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128);

/** Public representation of a user — never includes the password hash. */
export const UserPublic = z.object({
  id: z.string(),
  username: usernameSchema,
  email: z.string().email().nullable(),
  role: UserRole,
  avatarUrl: z.string().nullable(),
  bannerUrl: z.string().nullable(),
  bio: z.string().nullable(),
  ratingScale: RatingScale,
  createdAt: z.string().datetime(),
});
export type UserPublic = z.infer<typeof UserPublic>;

/** POST /auth/setup — creates the first admin. Only valid when zero users exist. */
export const SetupRequest = z.object({
  username: usernameSchema,
  email: z.string().email().optional(),
  password: passwordSchema,
});
export type SetupRequest = z.infer<typeof SetupRequest>;

export const RegisterRequest = SetupRequest;
export type RegisterRequest = z.infer<typeof RegisterRequest>;

export const LoginRequest = z.object({
  username: z.string(),
  password: z.string(),
});
export type LoginRequest = z.infer<typeof LoginRequest>;

/** Access token returned in the body; the refresh token is set as an httpOnly cookie. */
export const AuthTokens = z.object({
  accessToken: z.string(),
  expiresIn: z.number().int(),
});
export type AuthTokens = z.infer<typeof AuthTokens>;

export const AuthResponse = z.object({
  user: UserPublic,
  tokens: AuthTokens,
});
export type AuthResponse = z.infer<typeof AuthResponse>;

/** GET /auth/status — lets the web app decide between first-run setup vs. login. */
export const SetupStatus = z.object({
  needsSetup: z.boolean(),
});
export type SetupStatus = z.infer<typeof SetupStatus>;
