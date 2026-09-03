import { z } from 'zod';
import type { usersGetPayload } from '../../generated/prisma/models/users.js';
import { USER_ROLES, type UserRole } from '../../users.js';

export const userListSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  membership_status: true,
  profile_picture: true,
  cover_picture: true,
  created_at: true,
  updated_at: true,
  created_by: true,
  updated_by: true,
} as const;

export const userDetailSelect = userListSelect;

export type UserListRow = usersGetPayload<{
  select: typeof userListSelect;
}>;

export type UserDetailRow = usersGetPayload<{
  select: typeof userDetailSelect;
}>;

export type UserPrismaListFilters = {
  role?: UserRole;
  active?: boolean;
};

function emptyToUndefined(value: unknown): unknown {
  if (value === '' || value === undefined || value === null) {
    return undefined;
  }
  return value;
}

export const listUsersQuerySchema = z.object({
  page: z.preprocess(
    (value) => (value === undefined || value === '' ? 1 : value),
    z.coerce.number().int().min(1)
  ),
  limit: z.preprocess(
    (value) => (value === undefined || value === '' ? 10 : value),
    z.coerce.number().int().min(1).max(100)
  ),
  search: z.preprocess(emptyToUndefined, z.string().optional()),
  role: z.preprocess(emptyToUndefined, z.enum(USER_ROLES).optional()),
  active: z.preprocess((value) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return emptyToUndefined(value);
  }, z.boolean().optional()),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export const createUserSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.email({ message: 'Please enter a valid email address.' }),
  role: z.enum(USER_ROLES),
});

export const updateUserSchema = z.object({
  id: z.uuid({ message: 'Invalid user ID.' }),
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  role: z.enum(USER_ROLES),
});
