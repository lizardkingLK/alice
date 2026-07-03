'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { auditCreate, auditUpdate, userActiveAuditUpdate } from '@/lib/audit';
import { getDbUser } from '@/lib/auth';
import {
  buildAuthCallbackUrl,
  resolveRequestOrigin,
} from '@/lib/auth-redirect';
import { z } from 'zod';

const createUserSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.email({ message: 'Please enter a valid email address.' }),
  role: z.enum(['admin', 'manager', 'member']),
});

const updateUserSchema = z.object({
  id: z.string().uuid({ message: 'Invalid user ID.' }),
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  role: z.enum(['admin', 'manager', 'member']),
});

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
    const adminSupabase = createAdminClient();

    // Check if the user already exists in public.users to avoid duplicating
    const { data: existingUser } = await adminSupabase
      .from('users')
      .select('id')
      .eq('email', validation.data.email)
      .maybeSingle();

    if (existingUser) {
      return {
        success: false,
        error: 'A user with this email address already exists in the registry.',
      };
    }

    const headersList = await headers();
    const requestOrigin = headersList.get('origin') ?? 'http://localhost:3000';
    const origin = resolveRequestOrigin(requestOrigin);
    const redirectToUrl = buildAuthCallbackUrl(origin, '/reset-password');

    // Invite the user in Supabase Auth
    const { data: inviteData, error: inviteError } =
      await adminSupabase.auth.admin.inviteUserByEmail(validation.data.email, {
        redirectTo: redirectToUrl,
        data: {
          name: validation.data.name,
          role: validation.data.role,
        },
      });

    if (inviteError) {
      return {
        success: false,
        error: `Failed to invite user via Auth: ${inviteError.message}`,
      };
    }

    const invitedUser = inviteData?.user;
    if (!invitedUser) {
      return {
        success: false,
        error: 'Failed to retrieve invited user details.',
      };
    }

    // Insert into public.users database table with correct auth ID
    const { error: dbError } = await adminSupabase.from('users').insert({
      id: invitedUser.id,
      name: validation.data.name,
      email: validation.data.email,
      role: validation.data.role,
      active: true,
      ...auditCreate(currentUser.id),
    });

    if (dbError) {
      // Rollback auth user if insertion into database fails
      await adminSupabase.auth.admin.deleteUser(invitedUser.id);
      return {
        success: false,
        error: `Database registration failed: ${dbError.message}`,
      };
    }

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
    const adminSupabase = createAdminClient();

    // 1. Update public.users status
    const { error: dbError } = await adminSupabase
      .from('users')
      .update(userActiveAuditUpdate(currentUser.id, active))
      .eq('id', userId);

    if (dbError) {
      return {
        success: false,
        error: dbError.message,
      };
    }

    // 2. Ban/unban in Supabase Auth to prevent logins
    const { error: authError } = await adminSupabase.auth.admin.updateUserById(
      userId,
      {
        ban_duration: active ? 'none' : '87600h',
      }
    );

    if (authError) {
      console.error(
        'Failed to update ban status in Supabase Auth:',
        authError.message
      );
    }

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
    const adminSupabase = createAdminClient();

    // 1. Update public.users database table
    const { error: dbError } = await adminSupabase
      .from('users')
      .update({
        name: validation.data.name,
        role: validation.data.role,
        ...auditUpdate(currentUser.id),
      })
      .eq('id', validation.data.id);

    if (dbError) {
      return {
        success: false,
        error: `Database update failed: ${dbError.message}`,
      };
    }

    // 2. Update metadata in Supabase Auth so it is in sync
    const { error: authError } = await adminSupabase.auth.admin.updateUserById(
      validation.data.id,
      {
        user_metadata: {
          name: validation.data.name,
          role: validation.data.role,
        },
      }
    );

    if (authError) {
      console.error('Failed to update user in Supabase Auth:', authError.message);
    }

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
