import { z } from 'zod';
import { getDbUser } from '@/lib/auth';
import { firstValidationError, type ActionState } from '@/lib/server-actions';
import { createTeamSchema as teamSchema, type Tables } from '@repo/types';

export type TeamFormData = z.infer<typeof teamSchema>;

type ManagePermissionResult =
  | { allowed: true; currentUser: Tables<'users'> }
  | { allowed: false; error: string };

export async function requireTeamManager(): Promise<ManagePermissionResult> {
  const currentUser = await getDbUser();
  if (!currentUser) {
    return { allowed: false, error: 'Not authenticated.' };
  }

  if (currentUser.role !== 'admin' && currentUser.role !== 'manager') {
    return {
      allowed: false,
      error: 'Unauthorized. Only admins and managers can manage teams.',
    };
  }

  return { allowed: true, currentUser };
}

export function parseTeamForm(
  formData: FormData
): { ok: true; data: TeamFormData } | { ok: false; state: ActionState } {
  const validation = teamSchema.safeParse({
    name: formData.get('name') as string,
    description: (formData.get('description') as string) || null,
    manager_id: formData.get('manager_id') as string,
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
