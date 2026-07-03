'use server';

import { revalidatePath } from 'next/cache';

import {
  buildProjectInsert,
  buildProjectUpdate,
  findDuplicateProjectKey,
  parseProjectForm,
  patchProjectById,
  requireProjectManager,
} from '@/lib/projects/admin-project';
import {
  actionFailure,
  actionSuccess,
  unexpectedActionError,
  type ActionState,
} from '@/lib/server-actions';
import { getDbUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

// eslint-disable-next-line no-unused-vars
type MutationAction = (actorId: string) => Promise<ActionState>;

async function runProjectMutation<T extends ActionState>(
  mutate: MutationAction
) {
  const permission = await requireProjectManager();
  if (!permission.allowed) {
    return actionFailure(permission.error);
  }

  try {
    return await mutate(permission.currentUser.id);
  } catch (err) {
    return unexpectedActionError(err) as T;
  }
}

export async function createProject(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState & { projectId?: string }> {
  return runProjectMutation(async (actorId) => {
    const parsed = parseProjectForm(formData);
    if (!parsed.ok) {
      return parsed.state;
    }

    const duplicate = await findDuplicateProjectKey(parsed.data.key);
    if (duplicate) {
      return duplicate;
    }

    const adminSupabase = createAdminClient();
    const { data, error } = await adminSupabase
      .from('projects')
      .insert(buildProjectInsert(parsed.data, actorId))
      .select('id')
      .single();

    if (error) {
      return actionFailure(`Database insertion failed: ${error.message}`);
    }

    revalidatePath('/projects');
    return { ...actionSuccess(), projectId: data.id };
  });
}

export async function updateProject(
  projectId: string,
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  return runProjectMutation(async (actorId) => {
    const parsed = parseProjectForm(formData);
    if (!parsed.ok) {
      return parsed.state;
    }

    const duplicate = await findDuplicateProjectKey(parsed.data.key, projectId);
    if (duplicate) {
      return duplicate;
    }

    const adminSupabase = createAdminClient();
    const { error } = await adminSupabase
      .from('projects')
      .update(buildProjectUpdate(parsed.data, actorId))
      .eq('id', projectId);

    if (error) {
      return actionFailure(`Database update failed: ${error.message}`);
    }

    revalidatePath('/projects');
    return actionSuccess();
  });
}

export async function softDeleteProject(
  projectId: string
): Promise<ActionState> {
  return runProjectMutation(async (actorId) => {
    const result = await patchProjectById(
      projectId,
      {
        deleted_at: new Date().toISOString(),
        status: 'archived',
      },
      actorId
    );

    if (result.success) {
      revalidatePath('/projects');
    }

    return result;
  });
}

export async function restoreProject(projectId: string): Promise<ActionState> {
  return runProjectMutation(async (actorId) => {
    const result = await patchProjectById(
      projectId,
      {
        deleted_at: null,
        status: 'active',
      },
      actorId
    );

    if (result.success) {
      revalidatePath('/projects');
    }

    return result;
  });
}

export async function hardDeleteProject(
  projectId: string
): Promise<ActionState> {
  const currentUser = await getDbUser();
  if (!currentUser) {
    return actionFailure('Not authenticated.');
  }

  if (currentUser.role !== 'admin') {
    return actionFailure(
      'Unauthorized. Only administrators can permanently delete projects.'
    );
  }

  try {
    const adminSupabase = createAdminClient();
    const { error } = await adminSupabase
      .from('projects')
      .delete()
      .eq('id', projectId);

    if (error) {
      return actionFailure(error.message);
    }

    revalidatePath('/projects');
    return actionSuccess();
  } catch (err) {
    return unexpectedActionError(err);
  }
}
