'use server';

import { getProjectList } from '@/app/projects/_services/projects.service.server';
import type { Project } from '@/app/projects/_services/projects.service.base';
import {
  DROPDOWN_CACHE_TAGS,
  invalidateDropdownCache,
} from '@/lib/cache/dropdown-cache';

/**
 * Create-sprint (and similar) dialogs keep RSC `projects` from page load.
 * Expire the 60s dropdown cache and re-read so Express/chat-created
 * projects appear without waiting for TTL.
 */
export async function loadProjectsForSprintForm(): Promise<Project[]> {
  invalidateDropdownCache(DROPDOWN_CACHE_TAGS.projects);
  return getProjectList();
}
