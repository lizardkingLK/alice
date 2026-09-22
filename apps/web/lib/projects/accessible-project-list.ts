import type { Project } from '@/app/projects/_services/projects.mutations.shared';
import { getProjectList } from '@/app/projects/_services/projects.reads.server';
import {
  DROPDOWN_CACHE_TAGS,
  invalidateDropdownCache,
} from '@/lib/cache/dropdown-cache';
import { listAccessibleProjectIds } from '@/lib/projects/project-workspace-access';

/** Keep only projects the viewer may use (membership ∪ ownership ∪ guest ACL). */
export function filterProjectsByAccessibleIds<
  T extends { readonly id: string },
>(projects: readonly T[], accessibleIds: readonly string[]): T[] {
  if (accessibleIds.length === 0) {
    return [];
  }

  const allowed = new Set(accessibleIds);
  return projects.filter((project) => allowed.has(project.id));
}

/**
 * Shared dropdown cache (`getProjectList`) post-filtered for the current user.
 * All roles use the same membership-scoped set (“my projects”).
 */
export async function getAccessibleProjectList(
  userId: string,
  options?: { readonly refreshCache?: boolean }
): Promise<Project[]> {
  if (!userId) {
    return [];
  }

  if (options?.refreshCache) {
    invalidateDropdownCache(DROPDOWN_CACHE_TAGS.projects);
  }

  const [projects, accessibleIds] = await Promise.all([
    getProjectList(),
    listAccessibleProjectIds(userId),
  ]);

  return filterProjectsByAccessibleIds(projects, accessibleIds);
}
