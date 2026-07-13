'use server';

import { revalidatePath } from 'next/cache';
import {
  createTeam as apiCreateTeam,
  updateTeam as apiUpdateTeam,
  softDeleteTeam as apiSoftDeleteTeam,
  restoreTeam as apiRestoreTeam,
  hardDeleteTeam as apiHardDeleteTeam,
} from '../_services/teams.service.server';
import { parseTeamForm, requireTeamManager } from '@/lib/teams/admin-team';
import {
  actionFailure,
  actionSuccess,
  unexpectedActionError,
  type ActionState,
} from '@/lib/server-actions';
import { getDbUser } from '@/lib/auth';

// eslint-disable-next-line no-unused-vars
type MutationAction = (actorId: string) => Promise<ActionState>;

async function runTeamMutation<T extends ActionState>(mutate: MutationAction) {
  const permission = await requireTeamManager();
  if (!permission.allowed) {
    return actionFailure(permission.error);
  }

  try {
    return await mutate(permission.currentUser.id);
  } catch (err) {
    return unexpectedActionError(err) as T;
  }
}

export async function createTeam(
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState & { teamId?: string }> {
  return runTeamMutation(async () => {
    const parsed = parseTeamForm(formData);
    if (!parsed.ok) {
      return parsed.state;
    }

    const team = await apiCreateTeam({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      manager_id: parsed.data.manager_id,
      tech_stack: parsed.data.tech_stack ?? null,
      status: parsed.data.status,
    });

    revalidatePath('/manager');
    return { ...actionSuccess(), teamId: team.id };
  });
}

export async function updateTeam(
  teamId: string,
  _prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  return runTeamMutation(async () => {
    const parsed = parseTeamForm(formData);
    if (!parsed.ok) {
      return parsed.state;
    }

    await apiUpdateTeam(teamId, {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      manager_id: parsed.data.manager_id,
      tech_stack: parsed.data.tech_stack ?? null,
      status: parsed.data.status,
    });

    revalidatePath('/manager');
    return actionSuccess();
  });
}

export async function softDeleteTeam(teamId: string): Promise<ActionState> {
  return runTeamMutation(async () => {
    await apiSoftDeleteTeam(teamId);
    revalidatePath('/manager');
    return actionSuccess();
  });
}

export async function restoreTeam(teamId: string): Promise<ActionState> {
  return runTeamMutation(async () => {
    await apiRestoreTeam(teamId);
    revalidatePath('/manager');
    return actionSuccess();
  });
}

export async function hardDeleteTeam(teamId: string): Promise<ActionState> {
  const currentUser = await getDbUser();
  if (!currentUser) {
    return actionFailure('Not authenticated.');
  }

  if (currentUser.role !== 'admin') {
    return actionFailure(
      'Unauthorized. Only administrators can permanently delete teams.'
    );
  }

  try {
    await apiHardDeleteTeam(teamId);
    revalidatePath('/manager');
    return actionSuccess();
  } catch (err) {
    return unexpectedActionError(err);
  }
}
