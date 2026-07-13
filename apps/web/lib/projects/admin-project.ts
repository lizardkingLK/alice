import { z } from 'zod';

import { auditCreateWithoutStatus, auditUpdate } from '@/lib/audit';
import { getDbUser } from '@/lib/auth';
import {
  actionFailure,
  firstValidationError,
  type ActionState,
} from '@/lib/server-actions';
import { createAdminClient } from '@/lib/supabase/admin';

import {
  createProjectSchema as projectSchema,
  type Tables,
  type TablesInsert,
  type TablesUpdate,
} from '@repo/types';

export type ProjectFormData = z.infer<typeof projectSchema>;

type ManagePermissionResult =
  | { allowed: true; currentUser: Tables<'users'> }
  | { allowed: false; error: string };

export async function requireProjectManager(): Promise<ManagePermissionResult> {
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

export function parseProjectForm(
  formData: FormData
): { ok: true; data: ProjectFormData } | { ok: false; state: ActionState } {
  const validation = projectSchema.safeParse({
    name: formData.get('name') as string,
    key: (formData.get('key') as string)?.toUpperCase(),
    description: (formData.get('description') as string) || null,
    owner_id: formData.get('owner_id') as string,
    start_date: (formData.get('start_date') as string) || null,
    end_date: (formData.get('end_date') as string) || null,
    status: (formData.get('status') as 'active' | 'archived') || 'active',
  });

  if (!validation.success) {
    return { ok: false, state: firstValidationError(validation.error.issues) };
  }

  return { ok: true, data: validation.data };
}

export function toProjectWriteFields(
  data: ProjectFormData
): Pick<
  TablesInsert<'projects'>,
  | 'name'
  | 'key'
  | 'description'
  | 'owner_id'
  | 'start_date'
  | 'end_date'
  | 'status'
> {
  return {
    name: data.name,
    key: data.key,
    description: data.description ?? null,
    owner_id: data.owner_id,
    start_date: data.start_date ?? null,
    end_date: data.end_date ?? null,
    status: data.status,
  };
}

export async function findDuplicateProjectKey(
  key: string,
  excludeProjectId?: string
): Promise<ActionState | null> {
  const adminSupabase = createAdminClient();
  let query = adminSupabase.from('projects').select('id').eq('key', key);

  if (excludeProjectId) {
    query = query.neq('id', excludeProjectId);
  }

  const { data: existingProject } = await query.maybeSingle();

  if (existingProject) {
    const noun = excludeProjectId ? 'Another project' : 'A project';
    return actionFailure(`${noun} with the key "${key}" already exists.`);
  }

  return null;
}

export function buildProjectInsert(
  data: ProjectFormData,
  actorId: string
): TablesInsert<'projects'> {
  return {
    ...toProjectWriteFields(data),
    deleted_at: null,
    ...auditCreateWithoutStatus(actorId),
  };
}

export function buildProjectUpdate(
  data: ProjectFormData,
  actorId: string
): TablesUpdate<'projects'> {
  return {
    ...toProjectWriteFields(data),
    ...auditUpdate(actorId),
  };
}

export async function patchProjectById(
  projectId: string,
  patch: TablesUpdate<'projects'>,
  actorId: string
): Promise<ActionState> {
  const adminSupabase = createAdminClient();
  const { error } = await adminSupabase
    .from('projects')
    .update({ ...patch, ...auditUpdate(actorId) })
    .eq('id', projectId);

  if (error) {
    return actionFailure(error.message);
  }

  return { success: true, error: null };
}
