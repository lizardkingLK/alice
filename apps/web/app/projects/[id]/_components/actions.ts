'use server';

import { revalidatePath } from 'next/cache';
import {
  addProjectMember,
  removeProjectMember,
} from '../../_services/projects.service.server';
import {
  actionFailure,
  actionSuccess,
  type ActionState,
} from '@/lib/server-actions';

export async function addMemberAction(
  projectId: string,
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = formData.get('userId') as string;
  if (!userId) {
    return actionFailure('User selection is required.');
  }

  try {
    await addProjectMember(projectId, userId);
    revalidatePath(`/projects/${projectId}`);
    return actionSuccess();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to add member.';
    return actionFailure(message);
  }
}

export async function removeMemberAction(
  projectId: string,
  userId: string
): Promise<ActionState> {
  try {
    await removeProjectMember(projectId, userId);
    revalidatePath(`/projects/${projectId}`);
    return actionSuccess();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to remove member.';
    return actionFailure(message);
  }
}
