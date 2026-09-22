'use server';

import { getDbUser } from '@/lib/auth';
import { getAccessibleProjectList } from '@/lib/projects/accessible-project-list';
import type { Project } from '@/app/projects/_services/projects.mutations.shared';

/**
 * Create-sprint (and similar) dialogs keep RSC `projects` from page load.
 * Expire the 60s dropdown cache and re-read so Express/chat-created
 * projects appear without waiting for TTL — then filter to the caller's
 * accessible (“my”) projects.
 */
export async function loadProjectsForSprintForm(): Promise<Project[]> {
  const dbUser = await getDbUser();
  if (!dbUser) {
    return [];
  }

  return getAccessibleProjectList(dbUser.id, {
    refreshCache: true,
  });
}
