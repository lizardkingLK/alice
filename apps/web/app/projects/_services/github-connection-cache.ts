import type { GithubConnectionDto, GithubRepoOption } from '@repo/types/api/v1';

let cachedGithubConnections: GithubConnectionDto[] | null = null;
const cachedRepositoriesByConn = new Map<string, GithubRepoOption[]>();

export function getCachedGithubConnections(): GithubConnectionDto[] | null {
  return cachedGithubConnections;
}

export function setCachedGithubConnections(
  connections: GithubConnectionDto[] | null
): void {
  cachedGithubConnections = connections;
}

export function getCachedGithubRepositories(
  connectionId = '__default__'
): GithubRepoOption[] | null {
  return cachedRepositoriesByConn.get(connectionId) ?? null;
}

export function setCachedGithubRepositories(
  connectionId = '__default__',
  repositories: GithubRepoOption[] = []
): void {
  cachedRepositoriesByConn.set(connectionId, repositories);
}

export function clearGithubCache(): void {
  cachedGithubConnections = null;
  cachedRepositoriesByConn.clear();
}
