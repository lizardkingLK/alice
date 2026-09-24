import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useGithubConnectionPicker } from '@/app/projects/_hooks/use-github-connection-picker';
import {
  clearGithubCache,
  setCachedGithubConnections,
  listGithubConnections,
  type GithubConnectionDto,
} from '@/app/projects/_services/projects.github.mutations.client';
import { GithubConnectionStatusEnum } from '@repo/types/api/v1';

vi.mock('@/app/projects/_services/projects.github.mutations.client', async () => {
  const actual = await vi.importActual<
    typeof import('@/app/projects/_services/projects.github.mutations.client')
  >('@/app/projects/_services/projects.github.mutations.client');
  return {
    ...actual,
    listGithubConnections: vi.fn(),
    listGithubRepositories: vi.fn().mockResolvedValue([]),
    startGithubOAuth: vi.fn().mockResolvedValue('https://github.com/login/oauth/authorize'),
  };
});

describe('useGithubConnectionPicker caching & loading behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearGithubCache();
  });

  it('fetches connections on mount when cache is empty', async () => {
    const mockData: GithubConnectionDto[] = [
      {
        id: 'conn-1',
        name: 'GitHub (@octocat)',
        status: GithubConnectionStatusEnum.active,
        account_login: 'octocat',
        has_access_token: true,
        has_refresh_token: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_admin_owned: true,
        can_manage: true,
      },
    ];
    vi.mocked(listGithubConnections).mockResolvedValueOnce(mockData);

    const { result } = renderHook(() => useGithubConnectionPicker());

    // Initially loading when cache is empty
    expect(result.current.isLoadingConnections).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoadingConnections).toBe(false);
    });

    expect(result.current.connections).toHaveLength(1);
    expect(result.current.activeConnection?.account_login).toBe('octocat');
    expect(listGithubConnections).toHaveBeenCalledTimes(1);
  });

  it('displays existing connection data immediately without spinner or refetch when data is cached', () => {
    const cachedData: GithubConnectionDto[] = [
      {
        id: 'conn-1',
        name: 'GitHub (@octocat)',
        status: GithubConnectionStatusEnum.active,
        account_login: 'octocat',
        has_access_token: true,
        has_refresh_token: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_admin_owned: true,
        can_manage: true,
      },
    ];
    setCachedGithubConnections(cachedData);

    const { result } = renderHook(() => useGithubConnectionPicker());

    // Instant data: no loading spinner on mount!
    expect(result.current.isLoadingConnections).toBe(false);
    expect(result.current.connections).toEqual(cachedData);
    expect(result.current.activeConnection?.account_login).toBe('octocat');

    // No refetch triggered because cache is already populated
    expect(listGithubConnections).not.toHaveBeenCalled();
  });
});
