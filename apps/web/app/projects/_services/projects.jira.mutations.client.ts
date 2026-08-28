import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';

/**
 * Jira Cloud search + bulk work-item create often exceeds the default 20s
 * apiFetch abort (same pattern as chat / Gemini tool loops).
 */
const JIRA_IMPORT_FETCH_TIMEOUT_MS = 90_000;

export type JiraConnection = {
  id: string;
  user_id: string;
  cloud_id: string;
  site_url: string;
  account_email: string | null;
  scopes: string;
  status: 'active' | 'revoked' | 'expired';
  created_at: string;
  updated_at: string;
};

export type JiraCloudProject = {
  id: string;
  key: string;
  name: string;
};

export async function listJiraConnections(): Promise<JiraConnection[]> {
  const data = await apiFetch<{ connections: JiraConnection[] }>(
    '/api/jira/connections'
  );
  return data.connections;
}

export async function startJiraOAuth(): Promise<string> {
  const data = await apiFetch<{ url: string }>('/api/jira/oauth/start');
  return data.url;
}

export async function listJiraConnectionProjects(
  connectionId: string
): Promise<JiraCloudProject[]> {
  const data = await apiFetch<{ projects: JiraCloudProject[] }>(
    `/api/jira/connections/${connectionId}/projects`
  );
  return data.projects;
}

export async function deleteJiraConnection(
  connectionId: string
): Promise<void> {
  await apiFetch<void>(`/api/jira/connections/${connectionId}`, {
    method: 'DELETE',
  });
}

export async function importJiraIssues(
  projectId: string
): Promise<{ importedCount: number }> {
  return apiFetch<{ importedCount: number }>(
    `/api/projects/${projectId}/jira/import`,
    {
      method: 'POST',
      timeoutMs: JIRA_IMPORT_FETCH_TIMEOUT_MS,
    }
  );
}

export function connectionLabel(connection: JiraConnection): string {
  const site = connection.site_url.replace(/^https?:\/\//, '');
  if (connection.account_email) {
    return `${site} (${connection.account_email})`;
  }
  return site;
}
