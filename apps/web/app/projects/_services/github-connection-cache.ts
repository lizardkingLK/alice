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
  connectionId?: string
): GithubRepoOption[] | null {
  const key = connectionId || '__default__';
  return cachedRepositoriesByConn.get(key) ?? null;
}

export function setCachedGithubRepositories(
  connectionId: string | undefined,
  repositories: GithubRepoOption[]
): void {
  const key = connectionId || '__default__';
  cachedRepositoriesByConn.set(key, repositories);
}

export function clearGithubCache(): void {
  cachedGithubConnections = null;
  cachedRepositoriesByConn.clear();
}
