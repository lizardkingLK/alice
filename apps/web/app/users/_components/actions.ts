'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import {
  createUser as apiCreateUser,
  updateUser as apiUpdateUser,
  toggleUserActive as apiToggleUserActive,
} from '../_services/users.service.server';
import {
  buildAuthCallbackUrl,
  resolveRequestOrigin,
} from '@/lib/auth-redirect';
import { getDbUser } from '@/lib/auth';
import { createUserSchema, updateUserSchema } from '@repo/types';

export type ActionState = {
  success: boolean;
  error: string | null;
};

export async function createUser(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const role = formData.get('role') as string;

  const validation = createUserSchema.safeParse({ name, email, role });

  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message ?? 'Invalid input data.',
    };
  }

  // Verify the currently logged-in user is an admin
  const currentUser = await getDbUser();
  if (!currentUser) {
    return {
      success: false,
      error: 'Not authenticated.',
    };
  }

  if (currentUser.role !== 'admin') {
    return {
      success: false,
      error: 'Unauthorized. Only administrators can add new users.',
    };
  }

  try {
    const headersList = await headers();
    const requestOrigin = headersList.get('origin') ?? 'http://localhost:3000';
    const origin = resolveRequestOrigin(requestOrigin);
    const redirectToUrl = buildAuthCallbackUrl(origin, '/reset-password');

    // Call API backend
    await apiCreateUser({
      name: validation.data.name,
      email: validation.data.email,
      role: validation.data.role,
      redirectTo: redirectToUrl,
    });

    revalidatePath('/users');
    return {
      success: true,
      error: null,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred.';
    return {
      success: false,
      error: message,
    };
  }
}

export async function toggleUserActive(
  userId: string,
  active: boolean
): Promise<ActionState> {
  const currentUser = await getDbUser();
  if (!currentUser) {
    return {
      success: false,
      error: 'Not authenticated.',
    };
  }

  if (currentUser.role !== 'admin') {
    return {
      success: false,
      error: 'Unauthorized. Only administrators can modify user status.',
    };
  }

  if (userId === currentUser.id && !active) {
    return {
      success: false,
      error: 'Self lockout protection: You cannot deactivate your own account.',
    };
  }

  try {
    // Call API backend
    await apiToggleUserActive(userId, active);

    revalidatePath('/users');
    return {
      success: true,
      error: null,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred.';
    return {
      success: false,
      error: message,
    };
  }
}

export async function updateUser(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const id = formData.get('id') as string;
  const name = formData.get('name') as string;
  const role = formData.get('role') as string;

  const validation = updateUserSchema.safeParse({ id, name, role });

  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message ?? 'Invalid input data.',
    };
  }

  // Verify the currently logged-in user is an admin
  const currentUser = await getDbUser();
  if (!currentUser) {
    return {
      success: false,
      error: 'Not authenticated.',
    };
  }

  if (currentUser.role !== 'admin') {
    return {
      success: false,
      error: 'Unauthorized. Only administrators can edit users.',
    };
  }

  try {
    // Call API backend
    await apiUpdateUser(validation.data.id, {
      name: validation.data.name,
      role: validation.data.role,
    });

    revalidatePath('/users');
    return {
      success: true,
      error: null,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred.';
    return {
      success: false,
      error: message,
    };
  }
}
