import { createClient } from '@/lib/supabase/server';
import { throwIfError } from '@/lib/db/query';
import type { BoardDefaultsPreference } from '@/app/board/_helpers/board-defaults-storage';
import type { Project } from '@/app/projects/_services/projects.service.base';
import type { Sprint } from '@/app/sprints/_services/sprints.service';
import { filterActiveProjects } from '@/lib/projects/active-projects';

/**
 * Active project ids where the user is an active project member.
 */
export async function getActiveMemberProjectIds(
  userId: string
): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('project_members')
    .select('project_id')
    .eq('user_id', userId)
    .eq('status', 'active');

  throwIfError(
    error,
    'failed to list member projects',
    'Failed to list member projects'
  );

  return (data ?? []).map((row) => row.project_id);
}

export {
  buildBoardFilterRedirectPath,
  resolveDefaultBoardProject,
  resolveDefaultBoardSprint,
} from './board-defaults';

import {
  resolveDefaultBoardProject,
  resolveDefaultBoardSprint,
} from './board-defaults';

/** Suggested project/sprint when the user has no saved workspace defaults yet. */
export async function getSuggestedBoardDefaults(
  dbUser: { readonly id: string; readonly role: string },
  projects: readonly Project[],
  sprints: readonly Sprint[]
): Promise<BoardDefaultsPreference | null> {
  const activeProjects = filterActiveProjects([...projects]);
  if (activeProjects.length === 0) {
    return null;
  }

  const isAdmin = dbUser.role === 'admin';
  const memberProjectIds = isAdmin
    ? activeProjects.map((project) => project.id)
    : await getActiveMemberProjectIds(dbUser.id);

  const defaultProject = resolveDefaultBoardProject(activeProjects, {
    userId: dbUser.id,
    role: dbUser.role,
    memberProjectIds,
  });

  if (!defaultProject) {
    return null;
  }

  const defaultSprint = resolveDefaultBoardSprint(sprints, defaultProject.id);
  return {
    projectId: defaultProject.id,
    sprintId: defaultSprint?.id ?? null,
  };
}
