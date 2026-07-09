'use server';

import { revalidatePath } from 'next/cache';
import {
  createProject as apiCreateProject,
  updateProject as apiUpdateProject,
  softDeleteProject as apiSoftDeleteProject,
  restoreProject as apiRestoreProject,
  hardDeleteProject as apiHardDeleteProject,
} from '../_services/projects.service';
import {
  parseProjectForm,
  requireProjectManager,
} from '@/lib/projects/admin-project';
import {
  actionFailure,
  actionSuccess,
  unexpectedActionError,
  type ActionState,
} from '@/lib/server-actions';
import { getDbUser } from '@/lib/auth';

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
  return runProjectMutation(async () => {
    const parsed = parseProjectForm(formData);
    if (!parsed.ok) {
      return parsed.state;
    }

    // Call API backend
    const project = await apiCreateProject({
      name: parsed.data.name,
      key: parsed.data.key,
      description: parsed.data.description ?? null,
      owner_id: parsed.data.owner_id,
      start_date: parsed.data.start_date ?? null,
      end_date: parsed.data.end_date ?? null,
      status: parsed.data.status,
    });

    revalidatePath('/projects');
    return { ...actionSuccess(), projectId: project.id };
  });
}

export async function updateProject(
  projectId: string,
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  return runProjectMutation(async () => {
    const parsed = parseProjectForm(formData);
    if (!parsed.ok) {
      return parsed.state;
    }

    // Call API backend
    await apiUpdateProject(projectId, {
      name: parsed.data.name,
      key: parsed.data.key,
      description: parsed.data.description ?? null,
      owner_id: parsed.data.owner_id,
      start_date: parsed.data.start_date ?? null,
      end_date: parsed.data.end_date ?? null,
      status: parsed.data.status,
    });

    revalidatePath('/projects');
    return actionSuccess();
  });
}

export async function softDeleteProject(
  projectId: string
): Promise<ActionState> {
  return runProjectMutation(async () => {
    await apiSoftDeleteProject(projectId);
    revalidatePath('/projects');
    return actionSuccess();
  });
}

export async function restoreProject(projectId: string): Promise<ActionState> {
  return runProjectMutation(async () => {
    await apiRestoreProject(projectId);
    revalidatePath('/projects');
    return actionSuccess();
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
    await apiHardDeleteProject(projectId);
    revalidatePath('/projects');
    return actionSuccess();
  } catch (err) {
    return unexpectedActionError(err);
  }
}
