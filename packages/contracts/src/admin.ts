import { z } from 'zod';
import { UserRole } from './enums.js';
import { passwordSchema, usernameSchema, UserPublic } from './auth.js';

/** A user row in the admin panel — the public profile plus light activity counts. */
export const AdminUser = UserPublic.extend({
  libraryCount: z.number().int(),
  ratingCount: z.number().int(),
});
export type AdminUser = z.infer<typeof AdminUser>;

export const AdminUserListResponse = z.object({
  users: z.array(AdminUser),
});
export type AdminUserListResponse = z.infer<typeof AdminUserListResponse>;

/** POST /admin/users — an admin provisions an account directly. */
export const AdminCreateUserRequest = z.object({
  username: usernameSchema,
  email: z.string().email().optional(),
  password: passwordSchema,
  role: UserRole.default('USER'),
});
export type AdminCreateUserRequest = z.infer<typeof AdminCreateUserRequest>;

/** PATCH /admin/users/:id — edit an existing account. All fields optional;
 *  `password`, when present, resets the account's password. */
export const AdminUpdateUserRequest = z
  .object({
    username: usernameSchema.optional(),
    email: z.string().email().nullable().optional(),
    role: UserRole.optional(),
    password: passwordSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No changes provided' });
export type AdminUpdateUserRequest = z.infer<typeof AdminUpdateUserRequest>;
