import {
  normalizeProjectWorkItemTypeDefs,
  SEED_WORK_ITEM_TYPE_KEYS,
  workItemTypeDisplayName,
} from '@repo/types';
import { collectTypeOptionsFromWitCatalog } from '@/app/work-items/_helpers/wit-catalog-storage';

type ProjectWithWorkflow = {
  readonly id: string;
  readonly workflow_config?: unknown;
  readonly workflowConfig?: unknown;
};

export type WorkItemTypeFilterOption = {
  readonly value: string;
  readonly label: string;
};

function workflowTypesFromProject(project: ProjectWithWorkflow): unknown {
  if (project.workflow_config != null) {
    return (project.workflow_config as { work_item_types?: unknown })
      .work_item_types;
  }
  if (project.workflowConfig != null) {
    return (project.workflowConfig as { work_item_types?: unknown })
      .work_item_types;
  }
  return undefined;
}

function scopedProjectsForTypeFilter(
  projects: readonly ProjectWithWorkflow[] | null | undefined,
  projectId: string | null | undefined
): readonly ProjectWithWorkflow[] {
  if (!projects) {
    return [];
  }
  if (projectId && projectId !== 'all') {
    return projects.filter((project) => project.id === projectId);
  }
  return projects;
}

function addProjectCatalogLabels(
  byKey: Map<string, string>,
  projects: readonly ProjectWithWorkflow[]
): void {
  for (const project of projects) {
    const defs = normalizeProjectWorkItemTypeDefs(
      workflowTypesFromProject(project)
    );
    for (const def of defs) {
      if (!byKey.has(def.key)) {
        byKey.set(def.key, workItemTypeDisplayName(def.key, defs));
      }
    }
  }
}

function addWitCatalogLabels(
  byKey: Map<string, string>,
  userId: string | null | undefined,
  projectId?: string | null
): void {
  if (!userId) {
    return;
  }
  for (const option of collectTypeOptionsFromWitCatalog(userId, projectId)) {
    if (!byKey.has(option.key)) {
      byKey.set(option.key, option.name);
    }
  }
}

function ensureSeedTypeLabels(byKey: Map<string, string>): void {
  if (byKey.size > 0) {
    return;
  }
  for (const key of SEED_WORK_ITEM_TYPE_KEYS) {
    byKey.set(key, key);
  }
}

/**
 * Unique type filter options (value = catalog key, label = display name)
 * from project catalogs, optionally scoped to one project and merged with
 * the client type cache.
 */
export function collectWorkItemTypeFilterOptions(params: {
  readonly projects?: readonly ProjectWithWorkflow[] | null;
  readonly projectId?: string | null;
  readonly userId?: string | null;
}): WorkItemTypeFilterOption[] {
  const { projects, projectId, userId } = params;
  const byKey = new Map<string, string>();

  const scopedProjectId = projectId && projectId !== 'all' ? projectId : null;
  addProjectCatalogLabels(
    byKey,
    scopedProjectsForTypeFilter(projects, scopedProjectId)
  );
  addWitCatalogLabels(byKey, userId, scopedProjectId);
  ensureSeedTypeLabels(byKey);

  return [...byKey.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
