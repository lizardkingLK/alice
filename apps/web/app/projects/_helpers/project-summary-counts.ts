import type { Project } from '@/app/projects/_types/projects.types';

/**
 * Count JSON Schema `properties` on a project's dynamic fields config.
 */
export function countProjectFields(attributesConfig: unknown): number {
  if (!attributesConfig || typeof attributesConfig !== 'object') {
    return 0;
  }

  const properties = (attributesConfig as { properties?: unknown }).properties;
  if (!properties || typeof properties !== 'object') {
    return 0;
  }

  return Object.keys(properties).length;
}

/**
 * Count linked integrations (Jira site + project key, and/or GitHub repo/token).
 */
export function countProjectIntegrations(project: Project): number {
  let count = 0;

  if (project.jira_connection_id && project.jira_project_key) {
    count += 1;
  }

  if (project.github_repo || project.has_github_token) {
    count += 1;
  }

  return count;
}
