import { z } from 'zod';
import { firstValidationError, type ActionState } from '@/lib/server-actions';
import {
  requireManagerRole,
  type ManagePermissionResult,
} from '@/lib/require-manager-role';
import { createTeamSchema as teamSchema, type Tables } from '@repo/types';

export type TeamFormData = z.infer<typeof teamSchema>;

export async function requireTeamManager(): Promise<ManagePermissionResult> {
  return requireManagerRole(
    'Unauthorized. Only admins and managers can manage teams.'
  );
}

export function parseTeamForm(
  formData: FormData
): { ok: true; data: TeamFormData } | { ok: false; state: ActionState } {
  const validation = teamSchema.safeParse({
    name: formData.get('name') as string,
    description: (formData.get('description') as string) || null,
    manager_id: formData.get('manager_id') as string,
    project_id: formData.get('project_id') as string,
    tech_stack: (formData.get('tech_stack') as string) || null,
    status:
      (formData.get('status') as
        'active' | 'inactive' | 'archived' | 'deleted') || 'active',
  });

  if (!validation.success) {
    return { ok: false, state: firstValidationError(validation.error.issues) };
  }

  return { ok: true, data: validation.data };
}

export function toTeamWriteFields(
  data: TeamFormData
): Pick<
  Tables<'teams'>,
  'name' | 'description' | 'manager_id' | 'project_id' | 'tech_stack' | 'status'
> {
  return {
    name: data.name,
    description: data.description ?? null,
    manager_id: data.manager_id,
    project_id: data.project_id,
    tech_stack: data.tech_stack ?? null,
    status: data.status,
  };
}
