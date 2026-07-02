'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { auditCreateWithoutStatus, auditUpdate } from '@/lib/audit';
import { getDbUser } from '@/lib/auth';
import { z } from 'zod';

import type { Tables } from '@repo/types';

const projectSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  key: z
    .string()
    .min(2, { message: 'Key must be at least 2 characters.' })
    .max(10, { message: 'Key must be at most 10 characters.' })
    .regex(/^[A-Z0-9]+$/, {
      message: 'Key must contain only uppercase letters and numbers.',
    }),
  description: z.string().nullable().optional(),
  owner_id: z.uuid({ message: 'Please select a valid owner.' }),
  start_date: z.string().or(z.null()).optional(),
  end_date: z.string().or(z.null()).optional(),
  status: z.enum(['active', 'archived']).default('active'),
});

export type ActionState = {
  success: boolean;
  error: string | null;
};

// Check if user has permission to manage projects (admin or manager)
async function checkManagePermission(): Promise<
  | { allowed: true; currentUser: Tables<'users'> }
  | { allowed: false; error: string }
> {
  const currentUser = await getDbUser();
  if (!currentUser) {
    return { allowed: false, error: 'Not authenticated.' };
  }

  if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
    return {
      allowed: false,
      error: 'Unauthorized. Only admins and managers can manage projects.',
    };
  }

  return { allowed: true, currentUser };
}

export async function createProject(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const permission = await checkManagePermission();
  if (!permission.allowed) {
    return { success: false, error: permission.error ?? 'Unauthorized' };
  }

  const name = formData.get('name') as string;
  const key = (formData.get('key') as string)?.toUpperCase();
  const description = (formData.get('description') as string) || null;
  const owner_id = formData.get('owner_id') as string;
  const start_date = (formData.get('start_date') as string) || null;
  const end_date = (formData.get('end_date') as string) || null;
  const status = (formData.get('status') as 'active' | 'archived') || 'active';

  const validation = projectSchema.safeParse({
    name,
    key,
    description,
    owner_id,
    start_date,
    end_date,
    status,
  });

  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message ?? 'Invalid input data.',
    };
  }

  try {
    const adminSupabase = createAdminClient();

    // Check if the key already exists
    const { data: existingProject } = await adminSupabase
      .from('projects')
      .select('id')
      .eq('key', validation.data.key)
      .maybeSingle();

    if (existingProject) {
      return {
        success: false,
        error: `A project with the key "${validation.data.key}" already exists.`,
      };
    }

    const { error: dbError } = await adminSupabase.from('projects').insert({
      name: validation.data.name,
      key: validation.data.key,
      description: validation.data.description,
      owner_id: validation.data.owner_id,
      start_date: validation.data.start_date,
      end_date: validation.data.end_date,
      status: validation.data.status,
      deleted_at: null,
      ...auditCreateWithoutStatus(permission.currentUser.id),
    });

    if (dbError) {
      return {
        success: false,
        error: `Database insertion failed: ${dbError.message}`,
      };
    }

    revalidatePath('/admin');
    return {
      success: true,
      error: null,
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : 'An unexpected error occurred.',
    };
  }
}

export async function updateProject(
  projectId: string,
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const permission = await checkManagePermission();
  if (!permission.allowed) {
    return { success: false, error: permission.error ?? 'Unauthorized' };
  }

  const name = formData.get('name') as string;
  const key = (formData.get('key') as string)?.toUpperCase();
  const description = (formData.get('description') as string) || null;
  const owner_id = formData.get('owner_id') as string;
  const start_date = (formData.get('start_date') as string) || null;
  const end_date = (formData.get('end_date') as string) || null;
  const status = (formData.get('status') as 'active' | 'archived') || 'active';

  const validation = projectSchema.safeParse({
    name,
    key,
    description,
    owner_id,
    start_date,
    end_date,
    status,
  });

  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message ?? 'Invalid input data.',
    };
  }

  try {
    const adminSupabase = createAdminClient();

    // Check if another project already uses the key
    const { data: existingProject } = await adminSupabase
      .from('projects')
      .select('id')
      .eq('key', validation.data.key)
      .neq('id', projectId)
      .maybeSingle();

    if (existingProject) {
      return {
        success: false,
        error: `Another project with the key "${validation.data.key}" already exists.`,
      };
    }

    const { error: dbError } = await adminSupabase
      .from('projects')
      .update({
        name: validation.data.name,
        key: validation.data.key,
        description: validation.data.description,
        owner_id: validation.data.owner_id,
        start_date: validation.data.start_date,
        end_date: validation.data.end_date,
        status: validation.data.status,
        ...auditUpdate(permission.currentUser.id),
      })
      .eq('id', projectId);

    if (dbError) {
      return {
        success: false,
        error: `Database update failed: ${dbError.message}`,
      };
    }

    revalidatePath('/admin');
    return {
      success: true,
      error: null,
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : 'An unexpected error occurred.',
    };
  }
}

export async function softDeleteProject(
  projectId: string
): Promise<ActionState> {
  const permission = await checkManagePermission();
  if (!permission.allowed) {
    return { success: false, error: permission.error ?? 'Unauthorized' };
  }

  try {
    const adminSupabase = createAdminClient();
    const { error: dbError } = await adminSupabase
      .from('projects')
      .update({
        deleted_at: new Date().toISOString(),
        status: 'archived',
        ...auditUpdate(permission.currentUser.id),
      })
      .eq('id', projectId);

    if (dbError) {
      return { success: false, error: dbError.message };
    }

    revalidatePath('/admin');
    return { success: true, error: null };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : 'An unexpected error occurred.',
    };
  }
}

export async function restoreProject(projectId: string): Promise<ActionState> {
  const permission = await checkManagePermission();
  if (!permission.allowed) {
    return { success: false, error: permission.error ?? 'Unauthorized' };
  }

  try {
    const adminSupabase = createAdminClient();
    const { error: dbError } = await adminSupabase
      .from('projects')
      .update({
        deleted_at: null,
        status: 'active',
        ...auditUpdate(permission.currentUser.id),
      })
      .eq('id', projectId);

    if (dbError) {
      return { success: false, error: dbError.message };
    }

    revalidatePath('/admin');
    return { success: true, error: null };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : 'An unexpected error occurred.',
    };
  }
}

export async function hardDeleteProject(
  projectId: string
): Promise<ActionState> {
  const currentUser = await getDbUser();
  if (!currentUser) {
    return { success: false, error: 'Not authenticated.' };
  }

  if (currentUser.role !== 'admin') {
    return {
      success: false,
      error:
        'Unauthorized. Only administrators can permanently delete projects.',
    };
  }

  try {
    const adminSupabase = createAdminClient();
    const { error: dbError } = await adminSupabase
      .from('projects')
      .delete()
      .eq('id', projectId);

    if (dbError) {
      return { success: false, error: dbError.message };
    }

    revalidatePath('/admin');
    return { success: true, error: null };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : 'An unexpected error occurred.',
    };
  }
}
