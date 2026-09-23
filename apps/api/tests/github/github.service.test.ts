import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encryptSecret } from '../../src/lib/secrets/token-crypto';
import { GithubService } from '../../src/routes/api/github/github.service';
import type { GithubRepository } from '../../src/routes/api/github/github.repository';
import {
  GithubInsufficientScopeError,
  GithubReauthorizationRequiredError,
} from '../../src/routes/api/github/github.types';
import { IntegrationCategory, IntegrationStatus } from '@repo/types/prisma';

const { requireUserWithRoleMock } = vi.hoisted(() => {
  process.env.GITHUB_ACTIONS = 'true';
  return { requireUserWithRoleMock: vi.fn() };
});

vi.mock('../../src/lib/auth-helpers', () => ({
  requireUserWithRole: requireUserWithRoleMock,
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: {},
}));

const TEST_OAUTH_HMAC_KEY = Buffer.alloc(32, 1);

function signOAuthStateForTest(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', TEST_OAUTH_HMAC_KEY)
    .update(body)
    .digest()
    .toString('base64url');
  return `${body}.${sig}`;
}

describe('GithubService', () => {
  const findActiveMock = vi.fn();
  const listByUserIdMock = vi.fn();
  const listAllActiveMock = vi.fn();
  const findByIdMock = vi.fn();
  const upsertConnectionMock = vi.fn();
  const updateConfigMock = vi.fn();
  const updateStatusMock = vi.fn();
  const deleteByIdMock = vi.fn();

  const repository = {
    findActive: findActiveMock,
    listByUserId: listByUserIdMock,
    listAllActive: listAllActiveMock,
    findById: findByIdMock,
    upsertConnection: upsertConnectionMock,
    updateConfig: updateConfigMock,
    updateStatus: updateStatusMock,
    deleteById: deleteByIdMock,
  } as unknown as GithubRepository;

  const service = new GithubService(repository);

  beforeEach(() => {
    vi.clearAllMocks();
    requireUserWithRoleMock.mockResolvedValue({ id: 'user-1', role: 'admin' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds a valid GitHub authorize URL containing client_id, scopes, and signed state', async () => {
    const { url } = await service.startOAuth('user-1');

    expect(url).toContain('https://github.com/login/oauth/authorize?');
    expect(url).toContain('client_id=mock-github-client-id');
    expect(url).toContain('scope=repo+read%3Auser');
    expect(url).toContain('state=');
    expect(url).toContain('prompt=select_account');
  });

  it('exchanges authorization code, fetches user profile, and stores encrypted tokens in integrations table', async () => {
    const { url } = await service.startOAuth('user-1');
    const state = new URL(url).searchParams.get('state');
    expect(state).toBeTruthy();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'gho_fresh_access_token',
          refresh_token: 'ghr_fresh_refresh_token',
          expires_in: 28800,
          scope: 'repo,read:user',
          token_type: 'bearer',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 12345,
          login: 'octocat',
          name: 'The Octocat',
          avatar_url: 'https://avatars.githubusercontent.com/u/12345',
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    upsertConnectionMock.mockResolvedValue({
      id: 'int-1',
      catalog_id: 'github',
      category: IntegrationCategory.productivity,
      provider: 'github',
      name: 'GitHub (@octocat)',
      status: IntegrationStatus.active,
      config: {
        kind: 'github_oauth',
        access_token: encryptSecret('gho_fresh_access_token'),
        refresh_token: encryptSecret('ghr_fresh_refresh_token'),
        account_login: 'octocat',
        account_id: 12345,
        expires_at: new Date(Date.now() + 28800 * 1000).toISOString(),
        scope: 'repo,read:user',
      },
      is_default: false,
      sort_order: 0,
      created_by: 'user-1',
      created_at: new Date(),
      updated_by: 'user-1',
      updated_at: new Date(),
    });

    const connection = await service.handleOAuthCallback(
      'test-auth-code',
      state!
    );

    expect(connection.account_login).toBe('octocat');
    expect(connection.status).toBe('active');
    expect(upsertConnectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        name: 'GitHub (@octocat)',
        config: expect.objectContaining({
          kind: 'github_oauth',
          account_login: 'octocat',
          access_token: expect.stringMatching(/^v1:/),
          refresh_token: expect.stringMatching(/^v1:/),
        }),
        status: 'active',
      })
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects invalid or expired OAuth state', async () => {
    const invalidState = 'invalid.state.payload';
    await expect(
      service.handleOAuthCallback('code', invalidState)
    ).rejects.toThrow('Invalid OAuth state signature.');

    const expiredState = signOAuthStateForTest({
      userId: 'user-1',
      nonce: 'nonce-1',
      exp: Date.now() - 1000,
    });
    await expect(
      service.handleOAuthCallback('code', expiredState)
    ).rejects.toThrow('OAuth state has expired. Please try connecting again.');
  });

  it('returns decrypted access token directly without refresh when token is still valid', async () => {
    const validExpiry = new Date(Date.now() + 3600 * 1000).toISOString();
    findActiveMock.mockResolvedValue({
      id: 'int-1',
      provider: 'github',
      status: IntegrationStatus.active,
      config: {
        kind: 'github_oauth',
        access_token: encryptSecret('gho_valid_token'),
        refresh_token: encryptSecret('ghr_refresh_token'),
        expires_at: validExpiry,
        scope: 'repo,read:user',
      },
    });

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const token = await service.getValidAccessToken();

    expect(token).toBe('gho_valid_token');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(updateConfigMock).not.toHaveBeenCalled();
  });

  it('performs Just-In-Time (JIT) refresh when access token is expired', async () => {
    const expiredExpiry = new Date(Date.now() - 10 * 1000).toISOString();
    const expiredConnection = {
      id: 'int-1',
      provider: 'github',
      status: IntegrationStatus.active,
      config: {
        kind: 'github_oauth',
        access_token: encryptSecret('gho_old_token'),
        refresh_token: encryptSecret('ghr_existing_refresh_token'),
        expires_at: expiredExpiry,
        scope: 'repo,read:user',
        account_login: 'octocat',
      },
    };
    findActiveMock.mockResolvedValue(expiredConnection);
    findByIdMock.mockResolvedValue(expiredConnection);

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'gho_new_refreshed_token',
        refresh_token: 'ghr_new_rotated_refresh_token',
        expires_in: 28800,
        scope: 'repo,read:user',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const token = await service.getValidAccessToken('int-1');

    expect(token).toBe('gho_new_refreshed_token');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      'https://github.com/login/oauth/access_token'
    );
    expect(updateConfigMock).toHaveBeenCalledWith(
      'int-1',
      expect.objectContaining({
        access_token: expect.stringMatching(/^v1:/),
        refresh_token: expect.stringMatching(/^v1:/),
      }),
      'active'
    );
  });

  it('throws GithubReauthorizationRequiredError when expired and no refresh token is present', async () => {
    const expiredExpiry = new Date(Date.now() - 10 * 1000).toISOString();
    findActiveMock.mockResolvedValue({
      id: 'int-1',
      provider: 'github',
      status: IntegrationStatus.active,
      config: {
        kind: 'github_oauth',
        access_token: encryptSecret('gho_old_token'),
        expires_at: expiredExpiry,
        scope: 'repo,read:user',
      },
    });

    await expect(service.getValidAccessToken()).rejects.toThrow(
      GithubReauthorizationRequiredError
    );
    expect(updateStatusMock).toHaveBeenCalledWith('int-1', 'disabled');
  });

  it('throws GithubInsufficientScopeError when required scopes are missing', async () => {
    findActiveMock.mockResolvedValue({
      id: 'int-1',
      provider: 'github',
      status: IntegrationStatus.active,
      config: {
        kind: 'github_oauth',
        access_token: encryptSecret('gho_token'),
        scope: 'read:user',
      },
    });

    await expect(service.getValidAccessToken()).rejects.toThrow(
      GithubInsufficientScopeError
    );
  });

  it('fetches repositories for the connected user', async () => {
    const validExpiry = new Date(Date.now() + 3600 * 1000).toISOString();
    findActiveMock.mockResolvedValue({
      id: 'int-1',
      provider: 'github',
      status: IntegrationStatus.active,
      config: {
        kind: 'github_oauth',
        access_token: encryptSecret('gho_valid_token'),
        expires_at: validExpiry,
        scope: 'repo,read:user',
      },
    });

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: 1,
          name: 'react',
          full_name: 'facebook/react',
          owner: { login: 'facebook', avatar_url: 'https://avatars.com/fb' },
          private: false,
          html_url: 'https://github.com/facebook/react',
          default_branch: 'main',
          description: 'The library for web and native user interfaces',
        },
      ],
    });
    vi.stubGlobal('fetch', fetchMock);

    const repos = await service.listRepositories('user-1');

    expect(repos).toHaveLength(1);
    expect(repos[0]).toEqual({
      id: 1,
      name: 'react',
      full_name: 'facebook/react',
      owner: { login: 'facebook', avatar_url: 'https://avatars.com/fb' },
      private: false,
      html_url: 'https://github.com/facebook/react',
      default_branch: 'main',
      description: 'The library for web and native user interfaces',
    });
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      Authorization: 'Bearer gho_valid_token',
    });
  });

  describe('role-based authorization', () => {
    it('allows manager to manage GitHub connections', async () => {
      requireUserWithRoleMock.mockResolvedValue({ id: 'user-manager', role: 'manager' });
      listByUserIdMock.mockResolvedValue([]);
      listAllActiveMock.mockResolvedValue([]);

      const result = await service.listConnections('user-manager');
      expect(result).toEqual([]);
    });

    it('rejects member from managing GitHub connections', async () => {
      requireUserWithRoleMock.mockRejectedValue(
        new Error('Unauthorized. Only admins and managers can manage GitHub connections.')
      );

      await expect(service.startOAuth('user-member')).rejects.toThrow(
        'Unauthorized. Only admins and managers can manage GitHub connections.'
      );
      await expect(service.listConnections('user-member')).rejects.toThrow(
        'Unauthorized. Only admins and managers can manage GitHub connections.'
      );
      await expect(service.deleteConnection('user-member', 'conn-1')).rejects.toThrow(
        'Unauthorized. Only admins and managers can manage GitHub connections.'
      );
      await expect(service.listRepositories('user-member')).rejects.toThrow(
        'Unauthorized. Only admins and managers can manage GitHub connections.'
      );
    });
  });
});

