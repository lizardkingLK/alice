'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import {
  createUser as apiCreateUser,
  updateUser as apiUpdateUser,
  toggleUserActive as apiToggleUserActive,
} from '../_services/users.service.server';
import { buildAuthCallbackUrl } from '@/lib/auth-redirect';
import { resolveRequestOrigin } from '@/lib/auth-redirect.server';
import {
  DROPDOWN_CACHE_TAGS,
  invalidateDropdownCache,
} from '@/lib/cache/dropdown-cache';
import { requireAdmin } from '@/lib/rbac/require-role';
import {
  actionFailure,
  actionSuccess,
  firstValidationError,
  unexpectedActionError,
  type ActionState,
} from '@/lib/server-actions';
import { createUserSchema, updateUserSchema, type Tables } from '@repo/types';

export type { ActionState };

async function requireAdminAction(
  unauthorizedMessage: string
): Promise<
  | { allowed: true; currentUser: Tables<'users'> }
  | { allowed: false; state: ActionState }
> {
  const auth = await requireAdmin(unauthorizedMessage);
  if (!auth.allowed) {
    return { allowed: false, state: actionFailure(auth.error) };
  }
  return { allowed: true, currentUser: auth.currentUser };
}

function revalidateUsersViews() {
  revalidatePath('/users');
  invalidateDropdownCache(DROPDOWN_CACHE_TAGS.users);
}

export async function createUser(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const role = formData.get('role') as string;

  const validation = createUserSchema.safeParse({ name, email, role });
  if (!validation.success) {
    return firstValidationError(validation.error.issues);
  }

  const auth = await requireAdminAction(
    'Unauthorized. Only administrators can add new users.'
  );
  if (!auth.allowed) {
    return auth.state;
  }

  try {
    const headersList = await headers();
    const requestOrigin = headersList.get('origin') ?? 'http://localhost:3000';
    const origin = resolveRequestOrigin(requestOrigin);
    const redirectToUrl = buildAuthCallbackUrl(origin, '/reset-password');

    await apiCreateUser({
      name: validation.data.name,
      email: validation.data.email,
      role: validation.data.role,
      redirectTo: redirectToUrl,
    });

    revalidateUsersViews();
    return actionSuccess();
  } catch (err) {
    return unexpectedActionError(err);
  }
}

export async function toggleUserActive(
  userId: string,
  active: boolean,
  expectedUpdatedAt: string
): Promise<ActionState> {
  const auth = await requireAdminAction(
    'Unauthorized. Only administrators can modify user status.'
  );
  if (!auth.allowed) {
    return auth.state;
  }

  if (userId === auth.currentUser.id && !active) {
    return actionFailure(
      'Self lockout protection: You cannot deactivate your own account.'
    );
  }

  try {
    await apiToggleUserActive(userId, active, expectedUpdatedAt);
    revalidateUsersViews();
    return actionSuccess();
  } catch (err) {
    return unexpectedActionError(err);
  }
}

export async function updateUser(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const id = formData.get('id') as string;
  const name = formData.get('name') as string;
  const role = formData.get('role') as string;
  const expectedUpdatedAt = formData.get('expectedUpdatedAt') as string;

  const validation = updateUserSchema.safeParse({ id, name, role });
  if (!validation.success) {
    return firstValidationError(validation.error.issues);
  }

  const auth = await requireAdminAction(
    'Unauthorized. Only administrators can edit users.'
  );
  if (!auth.allowed) {
    return auth.state;
  }

  try {
    await apiUpdateUser(
      validation.data.id,
      {
        name: validation.data.name,
        role: validation.data.role,
      },
      expectedUpdatedAt
    );

    revalidateUsersViews();
    return actionSuccess();
  } catch (err) {
    return unexpectedActionError(err);
  }
}
