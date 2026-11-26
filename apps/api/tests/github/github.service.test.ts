import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encryptSecret } from '../../src/lib/secrets/token-crypto';
import { GithubService } from '../../src/routes/api/github/github.service';
import type { GithubRepository } from '../../src/routes/api/github/github.repository';
import {
  VersionControlConnectionStatus,
  VersionControlVendor,
} from '@repo/types/prisma';

const {
  requireUserWithRoleMock,
  fetchGithubAppMetadataMock,
  fetchGithubInstallationMock,
  createInstallationAccessTokenMock,
  requireGithubAppConfigMock,
} = vi.hoisted(() => {
  process.env.GITHUB_ACTIONS = 'true';
  return {
    requireUserWithRoleMock: vi.fn(),
    fetchGithubAppMetadataMock: vi.fn(),
    fetchGithubInstallationMock: vi.fn(),
    createInstallationAccessTokenMock: vi.fn(),
    requireGithubAppConfigMock: vi.fn(() => ({
      appId: '123456',
      privateKey: 'ci-unused-app-key',
    })),
  };
});

vi.mock('../../src/lib/auth-helpers', () => ({
  requireUserWithRole: requireUserWithRoleMock,
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: {},
}));

vi.mock(
  '../../src/routes/api/github/github-app-auth',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('../../src/routes/api/github/github-app-auth')
      >();
    return {
      ...actual,
      requireGithubAppConfig: requireGithubAppConfigMock,
      fetchGithubAppMetadata: fetchGithubAppMetadataMock,
      fetchGithubInstallation: fetchGithubInstallationMock,
      createInstallationAccessToken: createInstallationAccessTokenMock,
    };
  }
);

function vcConnection(overrides: Record<string, unknown> = {}) {
  return {
    id: 'vc-1',
    user_id: 'user-1',
    vendor: VersionControlVendor.github,
    external_id: '999001',
    display_label: 'GitHub App (@octocat)',
    provider_config: {
      auth_mode: 'app',
      account_login: 'octocat',
      account_name: 'The Octocat',
      installation_id: 999001,
    },
    refresh_token_enc: '',
    access_token_enc: encryptSecret('ghs_valid_token'),
    access_token_expires_at: new Date(Date.now() + 3600 * 1000),
    scopes: 'github_app:installation',
    status: VersionControlConnectionStatus.active,
    created_at: new Date(),
    updated_at: new Date(),
    user: { id: 'user-1', name: 'User 1', role: 'admin' },
    ...overrides,
  };
}

describe('GithubService', () => {
  const findActiveMock = vi.fn();
  const listByUserIdMock = vi.fn();
  const listAllActiveMock = vi.fn();
  const findByIdMock = vi.fn();
  const upsertConnectionMock = vi.fn();
  const updateTokensMock = vi.fn();
  const updateStatusMock = vi.fn();
  const deleteByIdMock = vi.fn();
  const findActiveAdminConnectionMock = vi.fn();
  const getUserByIdMock = vi.fn();

  const repository = {
    findActive: findActiveMock,
    listByUserId: listByUserIdMock,
    listAllActive: listAllActiveMock,
    findById: findByIdMock,
    upsertConnection: upsertConnectionMock,
    updateTokens: updateTokensMock,
    updateStatus: updateStatusMock,
    deleteById: deleteByIdMock,
    findActiveAdminConnection: findActiveAdminConnectionMock,
    getUserById: getUserByIdMock,
  } as unknown as GithubRepository;

  const service = new GithubService(repository);

  beforeEach(() => {
    vi.clearAllMocks();
    requireUserWithRoleMock.mockResolvedValue({ id: 'user-1', role: 'admin' });
    findActiveAdminConnectionMock.mockResolvedValue(null);
    getUserByIdMock.mockResolvedValue({
      id: 'user-1',
      name: 'User 1',
      role: 'admin',
    });
    requireGithubAppConfigMock.mockReturnValue({
      appId: '123456',
      privateKey: 'ci-unused-app-key',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts GitHub App install with signed state and app slug', async () => {
    fetchGithubAppMetadataMock.mockResolvedValueOnce({
      id: 123456,
      slug: 'alice-dev',
      name: 'Alice Dev',
    });

    const { url } = await service.startAppInstall('user-1');

    expect(url).toContain(
      'https://github.com/apps/alice-dev/installations/new?'
    );
    expect(url).toContain('state=');
    expect(fetchGithubAppMetadataMock).toHaveBeenCalledTimes(1);
    expect(requireGithubAppConfigMock).toHaveBeenCalled();
  });

  it('handles App install callback, mints installation token, and stores app connection', async () => {
    fetchGithubAppMetadataMock.mockResolvedValueOnce({
      id: 123456,
      slug: 'alice-dev',
    });
    const { url } = await service.startAppInstall('user-1');
    const state = new URL(url).searchParams.get('state');
    expect(state).toBeTruthy();

    fetchGithubInstallationMock.mockResolvedValueOnce({
      id: 999001,
      account: {
        id: 42,
        login: 'acme',
        avatar_url: 'https://avatars.githubusercontent.com/u/42',
        type: 'Organization',
        name: 'Acme Org',
      },
    });
    createInstallationAccessTokenMock.mockResolvedValueOnce({
      token: 'ghs_install_token',
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
    });

    upsertConnectionMock.mockResolvedValue(
      vcConnection({
        external_id: '999001',
        display_label: 'GitHub App (@acme)',
        provider_config: {
          auth_mode: 'app',
          account_login: 'acme',
          account_name: 'Acme Org',
          account_avatar_url: 'https://avatars.githubusercontent.com/u/42',
          account_type: 'Organization',
          installation_id: 999001,
        },
        refresh_token_enc: '',
        access_token_enc: encryptSecret('ghs_install_token'),
        scopes: 'github_app:installation',
      })
    );

    const connection = await service.handleAppInstallCallback('999001', state!);

    expect(connection.auth_mode).toBe('app');
    expect(connection.installation_id).toBe(999001);
    expect(connection.account_login).toBe('acme');
    expect(connection.account_type).toBe('Organization');
    expect(upsertConnectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        externalId: '999001',
        displayLabel: 'GitHub App (@acme)',
        refreshTokenEnc: '',
        accessTokenEnc: expect.stringMatching(/^v1:/),
        scopes: 'github_app:installation',
        providerConfig: expect.objectContaining({
          auth_mode: 'app',
          installation_id: 999001,
          account_login: 'acme',
          account_type: 'Organization',
        }),
      })
    );
    expect(fetchGithubInstallationMock).toHaveBeenCalledWith(999001);
    expect(createInstallationAccessTokenMock).toHaveBeenCalledWith(999001);
  });

  it('remints installation token when an App connection token is expired', async () => {
    const appConnection = vcConnection({
      external_id: '999001',
      provider_config: {
        auth_mode: 'app',
        account_login: 'acme',
        installation_id: 999001,
      },
      refresh_token_enc: '',
      access_token_enc: encryptSecret('ghs_old_token'),
      access_token_expires_at: new Date(Date.now() - 10 * 1000),
      scopes: 'github_app:installation',
    });
    findActiveMock.mockResolvedValue(appConnection);
    findByIdMock.mockResolvedValue(appConnection);
    updateTokensMock.mockResolvedValue(appConnection);

    createInstallationAccessTokenMock.mockResolvedValueOnce({
      token: 'ghs_new_token',
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
    });

    const token = await service.getValidAccessToken();

    expect(token).toBe('ghs_new_token');
    expect(createInstallationAccessTokenMock).toHaveBeenCalledWith(999001);
    expect(updateTokensMock).toHaveBeenCalledWith(
      'vc-1',
      expect.objectContaining({
        accessTokenEnc: expect.stringMatching(/^v1:/),
        refreshTokenEnc: '',
      })
    );
  });

  it('lists repositories via installation API for App connections', async () => {
    findActiveMock.mockResolvedValue(
      vcConnection({
        provider_config: {
          auth_mode: 'app',
          account_login: 'acme',
          installation_id: 999001,
        },
        refresh_token_enc: '',
        scopes: 'github_app:installation',
      })
    );

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        total_count: 1,
        repositories: [
          {
            id: 7,
            name: 'apollo',
            full_name: 'acme/apollo',
            owner: { login: 'acme' },
            private: true,
            html_url: 'https://github.com/acme/apollo',
            default_branch: 'main',
            description: null,
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const repos = await service.listRepositories('user-1');

    expect(repos).toHaveLength(1);
    expect(repos[0]?.full_name).toBe('acme/apollo');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      '/installation/repositories'
    );
  });

  it('returns decrypted installation token when still valid', async () => {
    findActiveMock.mockResolvedValue(vcConnection());

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const token = await service.getValidAccessToken();

    expect(token).toBe('ghs_valid_token');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(createInstallationAccessTokenMock).not.toHaveBeenCalled();
    expect(updateTokensMock).not.toHaveBeenCalled();
  });

  it('rejects legacy user OAuth connections', async () => {
    findActiveMock.mockResolvedValue(
      vcConnection({
        provider_config: {
          auth_mode: 'oauth',
          account_login: 'octocat',
        },
        scopes: 'repo,read:user',
        refresh_token_enc: encryptSecret('ghr_refresh_token'),
        access_token_enc: encryptSecret('gho_valid_token'),
      })
    );

    await expect(service.getValidAccessToken()).rejects.toThrow(
      /GitHub user OAuth is retired/
    );
  });

  describe('role-based authorization and ownership', () => {
    it('allows manager to manage GitHub connections', async () => {
      requireUserWithRoleMock.mockResolvedValue({
        id: 'user-manager',
        role: 'manager',
      });
      listByUserIdMock.mockResolvedValue([]);
      listAllActiveMock.mockResolvedValue([]);

      const result = await service.listConnections('user-manager');
      expect(result).toEqual([]);
    });

    it('allows member to view connections as read-only reference data', async () => {
      requireUserWithRoleMock.mockResolvedValue({
        id: 'user-member',
        role: 'member',
      });
      listByUserIdMock.mockResolvedValue([]);
      listAllActiveMock.mockResolvedValue([
        vcConnection({
          id: 'conn-admin-1',
          user_id: 'admin-1',
          user: { id: 'admin-1', name: 'Admin User', role: 'admin' },
        }),
      ]);

      const result = await service.listConnections('user-member');
      expect(result).toHaveLength(1);
      expect(result[0]?.account_login).toBe('octocat');
      expect(result[0]?.is_admin_owned).toBe(true);
      expect(result[0]?.can_manage).toBe(false);
      expect(result[0]?.created_by_role).toBe('admin');
    });

    it('rejects member from modifying or managing GitHub connections', async () => {
      requireUserWithRoleMock.mockRejectedValue(
        new Error(
          'Unauthorized. Only admins and managers can manage GitHub connections.'
        )
      );

      await expect(service.startAppInstall('user-member')).rejects.toThrow(
        'Unauthorized. Only admins and managers can manage GitHub connections.'
      );
      await expect(
        service.deleteConnection('user-member', 'conn-1')
      ).rejects.toThrow(
        'Unauthorized. Only admins and managers can manage GitHub connections.'
      );
      await expect(service.listRepositories('user-member')).rejects.toThrow(
        'Unauthorized. Only admins and managers can manage GitHub connections.'
      );
    });

    it('blocks manager from starting App install if an admin has an active connection', async () => {
      requireUserWithRoleMock.mockResolvedValue({
        id: 'manager-1',
        role: 'manager',
      });
      findActiveAdminConnectionMock.mockResolvedValue(
        vcConnection({
          id: 'admin-conn-1',
          user_id: 'admin-1',
          user: { id: 'admin-1', name: 'Admin', role: 'admin' },
        })
      );

      await expect(service.startAppInstall('manager-1')).rejects.toThrow(
        'An administrator has connected GitHub. That administrator must disconnect the existing connection before a different account can be connected.'
      );
    });

    it('blocks manager from deleting an admin-owned connection', async () => {
      requireUserWithRoleMock.mockResolvedValue({
        id: 'manager-1',
        role: 'manager',
      });
      findByIdMock.mockResolvedValue(
        vcConnection({
          id: 'admin-conn-1',
          user_id: 'admin-1',
          user: { id: 'admin-1', name: 'Admin', role: 'admin' },
        })
      );

      await expect(
        service.deleteConnection('manager-1', 'admin-conn-1')
      ).rejects.toThrow(
        'This GitHub connection was established by an administrator and can only be disconnected by that administrator.'
      );
    });

    it('allows the admin who created the connection to delete it', async () => {
      requireUserWithRoleMock.mockResolvedValue({
        id: 'admin-1',
        role: 'admin',
      });
      findByIdMock.mockResolvedValue(
        vcConnection({
          id: 'admin-conn-1',
          user_id: 'admin-1',
          user: { id: 'admin-1', name: 'Admin', role: 'admin' },
        })
      );
      deleteByIdMock.mockResolvedValue(true);

      await expect(
        service.deleteConnection('admin-1', 'admin-conn-1')
      ).resolves.toBeUndefined();
      expect(deleteByIdMock).toHaveBeenCalledWith('admin-conn-1');
    });
  });
});
