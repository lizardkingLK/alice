import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { selectSingleMock, upsertMock, findByIdForUserMock, updateTokensMock } =
  vi.hoisted(() => {
    process.env.GITHUB_ACTIONS = 'true';
    return {
      selectSingleMock: vi.fn(),
      upsertMock: vi.fn(),
      findByIdForUserMock: vi.fn(),
      updateTokensMock: vi.fn(),
    };
  });

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: selectSingleMock,
        })),
      })),
    })),
  },
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: {},
}));

import { encryptSecret } from '../../src/lib/secrets/token-crypto';
import { JiraService } from '../../src/routes/api/jira/jira.service';
import type { JiraRepository } from '../../src/routes/api/jira/jira.repository';

/** Matches `INTEGRATION_TOKEN_ENCRYPTION_KEY` in CI (`env.ts` GITHUB_ACTIONS defaults). */
const TEST_OAUTH_HMAC_KEY = Buffer.alloc(32, 1);

function signOAuthStateForTest(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', TEST_OAUTH_HMAC_KEY)
    .update(body)
    .digest()
    .toString('base64url');
  return `${body}.${sig}`;
}

describe('JiraService', () => {
  const repository = {
    listByUserId: vi.fn(),
    findById: vi.fn(),
    findByIdForUser: findByIdForUserMock,
    upsertByUserAndCloud: upsertMock,
    updateTokens: updateTokensMock,
    deleteByIdForUser: vi.fn(),
  } as unknown as JiraRepository;

  const service = new JiraService(repository);

  beforeEach(() => {
    vi.clearAllMocks();
    selectSingleMock.mockResolvedValue({
      data: { role: 'manager' },
      error: null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds an authorize URL bound to the actor', async () => {
    // Arrange / Act
    const { url } = await service.startOAuth('user-manager');

    // Assert
    expect(url).toContain('https://auth.atlassian.com/authorize?');
    expect(url).toContain('client_id=mock-atlassian-client-id');
    expect(url).toContain('audience=api.atlassian.com');
    expect(url).toContain('response_type=code');
    expect(url).toContain('prompt=consent');
    expect(url).toContain(encodeURIComponent('read:jira-work'));
    expect(url).toContain('state=');
  });

  it('exchanges OAuth code and upserts an encrypted connection', async () => {
    // Arrange
    const { url } = await service.startOAuth('user-manager');
    const state = new URL(url).searchParams.get('state');
    expect(state).toBeTruthy();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'access-1',
          refresh_token: 'refresh-1',
          expires_in: 3600,
          scope: 'read:jira-work read:jira-user offline_access',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 'cloud-1',
            url: 'https://acme.atlassian.net',
            name: 'Acme',
            scopes: ['read:jira-work', 'read:jira-user'],
          },
        ],
      });
    vi.stubGlobal('fetch', fetchMock);

    upsertMock.mockResolvedValue({
      id: 'conn-1',
      user_id: 'user-manager',
      cloud_id: 'cloud-1',
      site_url: 'https://acme.atlassian.net',
      account_email: null,
      scopes: 'read:jira-work read:jira-user offline_access',
      status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Act
    const connection = await service.handleOAuthCallback('auth-code', state!);

    // Assert
    expect(connection.cloud_id).toBe('cloud-1');
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-manager',
        cloud_id: 'cloud-1',
        site_url: 'https://acme.atlassian.net',
        refresh_token_enc: expect.stringMatching(/^v1:/),
        access_token_enc: expect.stringMatching(/^v1:/),
      })
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws TypeError when OAuth state payload field types are invalid', async () => {
    const state = signOAuthStateForTest({
      userId: 123,
      nonce: 'nonce-1',
      exp: Date.now() + 60_000,
    });

    await expect(service.handleOAuthCallback('auth-code', state)).rejects.toThrow(
      TypeError
    );
    await expect(service.handleOAuthCallback('auth-code', state)).rejects.toThrow(
      'Invalid OAuth state payload.'
    );
  });

  it('fetches issues for import with a Bearer token', async () => {
    // Arrange
    findByIdForUserMock.mockResolvedValue({
      id: 'conn-1',
      user_id: 'user-manager',
      cloud_id: 'cloud-1',
      site_url: 'https://acme.atlassian.net',
      account_email: null,
      refresh_token_enc: encryptSecret('refresh-plain'),
      access_token_enc: null,
      access_token_expires_at: null,
      scopes: 'read:jira-work',
      status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'access-fresh',
          refresh_token: 'refresh-rotated',
          expires_in: 3600,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          issues: [
            {
              key: 'ALICE-1',
              fields: {
                summary: 'First issue',
                description: 'Hello',
                issuetype: { name: 'Story' },
              },
            },
          ],
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    // Act
    const issues = await service.fetchIssuesForImport(
      'user-manager',
      'conn-1',
      'ALICE'
    );

    // Assert
    expect(issues).toEqual([
      expect.objectContaining({
        key: 'ALICE-1',
        title: 'First issue',
        description: 'Hello',
      }),
    ]);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain(
      'https://api.atlassian.com/ex/jira/cloud-1/rest/api/3/search/jql'
    );
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toMatchObject({
      Authorization: 'Bearer access-fresh',
    });
  });
});
