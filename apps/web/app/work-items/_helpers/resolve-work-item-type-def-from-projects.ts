import {
  findProjectWorkItemTypeDef,
  normalizeProjectWorkItemTypeDefs,
  type ProjectWorkItemTypeDef,
  type WorkItemType,
} from '@repo/types';

type ProjectWithWorkflow = {
  readonly id: string;
  readonly workflow_config?: unknown;
};

/** Catalog defs from a project `workflow_config` (or nullish). */
export function typeDefsFromWorkflowConfig(
  workflowConfig: unknown
): ProjectWorkItemTypeDef[] {
  return normalizeProjectWorkItemTypeDefs(
    (workflowConfig as { work_item_types?: unknown } | null)?.work_item_types
  );
}

/**
 * Resolve a catalog def from an in-memory projects list (live workflow_config).
 */
export function resolveWorkItemTypeDefFromProjects(
  projects: readonly ProjectWithWorkflow[] | null | undefined,
  projectId: string | null | undefined,
  type: WorkItemType | null | undefined
): ProjectWorkItemTypeDef | null {
  if (!projects || !projectId || !type) {
    return null;
  }
  const project = projects.find((entry) => entry.id === projectId);
  if (!project) {
    return null;
  }
  return findProjectWorkItemTypeDef(
    typeDefsFromWorkflowConfig(project.workflow_config),
    type
  );
}
