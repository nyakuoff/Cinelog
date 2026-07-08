import { z } from 'zod';
import { passwordSchema, usernameSchema } from './auth.js';

export const UpdateProfileRequest = z.object({
  username: usernameSchema.optional(),
  email: z.string().email().nullable().optional(),
  bio: z.string().max(500).nullable().optional(),
});
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequest>;

export const ChangePasswordRequest = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequest>;
