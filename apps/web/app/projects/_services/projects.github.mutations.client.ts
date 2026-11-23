import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';
import type { GithubConnectionDto, GithubRepoOption } from '@repo/types/api/v1';
import {
  getCachedGithubConnections,
  setCachedGithubConnections,
  getCachedGithubRepositories,
  setCachedGithubRepositories,
  clearGithubCache,
} from './github-connection-cache';

export type { GithubConnectionDto, GithubRepoOption };

export {
  getCachedGithubConnections,
  setCachedGithubConnections,
  getCachedGithubRepositories,
  setCachedGithubRepositories,
  clearGithubCache,
};

export async function listGithubConnections(
  force = false
): Promise<GithubConnectionDto[]> {
  const cached = getCachedGithubConnections();
  if (!force && cached !== null) {
    return cached;
  }
  const data = await apiFetch<{ connections: GithubConnectionDto[] }>(
    '/api/github/connections'
  );
  setCachedGithubConnections(data.connections);
  return data.connections;
}

async function startGithubAuthorizeUrl(path: string): Promise<string> {
  const data = await apiFetch<{ url: string }>(path);
  return data.url;
}

/** Preferred connect path — GitHub App install (Phase 1). */
export async function startGithubAppInstall(): Promise<string> {
  return startGithubAuthorizeUrl('/api/github/app/install/start');
}

/** Legacy user OAuth App connect — kept until Phase 5 migration. */
export async function startGithubOAuth(): Promise<string> {
  return startGithubAuthorizeUrl('/api/github/oauth/start');
}

export async function listGithubRepositories(
  connectionId?: string,
  force = false
): Promise<GithubRepoOption[]> {
  const cached = getCachedGithubRepositories(connectionId);
  if (!force && cached !== null) {
    return cached;
  }
  const query = connectionId
    ? `?connectionId=${encodeURIComponent(connectionId)}`
    : '';
  const data = await apiFetch<{ repositories: GithubRepoOption[] }>(
    `/api/github/repositories${query}`
  );
  setCachedGithubRepositories(connectionId, data.repositories);
  return data.repositories;
}

export async function deleteGithubConnection(
  connectionId: string
): Promise<void> {
  await apiFetch<void>(`/api/github/connections/${connectionId}`, {
    method: 'DELETE',
  });
  clearGithubCache();
}

export function githubConnectionLabel(connection: GithubConnectionDto): string {
  if (
    connection.account_name &&
    connection.account_name !== connection.account_login
  ) {
    return `@${connection.account_login} (${connection.account_name})`;
  }
  return `@${connection.account_login}`;
}
