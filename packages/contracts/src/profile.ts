import { z } from 'zod';
import { passwordSchema, usernameSchema } from './auth.js';
import { ProfileVisibility } from './enums.js';

export const UpdateProfileRequest = z.object({
  username: usernameSchema.optional(),
  email: z.string().email().nullable().optional(),
  bio: z.string().max(500).nullable().optional(),
  displayName: z.string().max(60).nullable().optional(),
  profileVisibility: ProfileVisibility.optional(),
  watchlistVisibility: ProfileVisibility.optional(),
});
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequest>;

export const ChangePasswordRequest = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequest>;

/** PATCH /users/me/favorites — set the up-to-4 ranked favorite titles shown on the profile. */
export const UpdateFavoritesRequest = z.object({
  mediaIds: z.array(z.string()).max(4),
});
export type UpdateFavoritesRequest = z.infer<typeof UpdateFavoritesRequest>;
