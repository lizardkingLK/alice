import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  encryptSecret,
  isEncryptedSecret,
} from '../../src/lib/secrets/token-crypto';
import {
  createOAuthStateWithPayload,
  verifyOAuthState,
} from '../../src/lib/secrets/oauth-state';
import type { ProjectsRepository } from '../../src/routes/api/projects/projects.repository';
import type { FigmaRepository } from '../../src/routes/api/figma/figma.repository';
import { FigmaService } from '../../src/routes/api/figma/figma.service';

const { requireUserWithRoleMock } = vi.hoisted(() => ({
  requireUserWithRoleMock: vi.fn(),
}));

vi.mock('../../src/lib/auth-helpers', () => ({
  requireUserWithRole: requireUserWithRoleMock,
}));

const USER_ID = '11111111-1111-4111-8111-111111111111';
const PROJECT_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_PROJECT_ID = '33333333-3333-4333-8333-333333333333';
const STATE_PURPOSE = 'sign Figma OAuth state (HMAC)';

function publicConnection(overrides: Record<string, unknown> = {}) {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    project_id: PROJECT_ID,
    authorized_by: USER_ID,
    figma_user_id: 'figma-user-1',
    scopes: 'file_metadata:read',
    access_token_expires_at: new Date(Date.now() + 3_600_000),
    verified_file_key: 'file-key-123',
    verified_file_name: 'Alice Design',
    verified_at: new Date(),
    verification_error: null,
    created_at: new Date(),
    updated_at: new Date(),
    authorized_by_user: { id: USER_ID, name: 'Alice Manager' },
    ...overrides,
  };
}

describe('FigmaService', () => {
  const createOAuthAttempt = vi.fn();
  const consumeOAuthAttempt = vi.fn();
  const getProject = vi.fn();
  const findConnectionByProjectId = vi.fn();
  const findFullConnectionByProjectId = vi.fn();
  const upsertConnection = vi.fn();
  const updateTokens = vi.fn();
  const updateVerification = vi.fn();
  const deleteConnection = vi.fn();
  const listAccessibleProjectIds = vi.fn();
  const fetchMock = vi.fn();
  const repository = {
    createOAuthAttempt,
    consumeOAuthAttempt,
    getProject,
    findConnectionByProjectId,
    findFullConnectionByProjectId,
    upsertConnection,
    updateTokens,
    updateVerification,
    deleteConnection,
  } as unknown as FigmaRepository;
  const projectsRepository = {
    listAccessibleProjectIds,
  } as unknown as Pick<ProjectsRepository, 'listAccessibleProjectIds'>;
  const service = new FigmaService(repository, projectsRepository);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    requireUserWithRoleMock.mockResolvedValue({
      id: USER_ID,
      role: 'manager',
    });
    listAccessibleProjectIds.mockResolvedValue([PROJECT_ID]);
    getProject.mockResolvedValue({
      id: PROJECT_ID,
      figma_url: 'https://www.figma.com/design/file-key-123/Alice-Design',
    });
    consumeOAuthAttempt.mockResolvedValue({
      id: 'attempt-1',
      project_id: PROJECT_ID,
      user_id: USER_ID,
      code_verifier_enc: encryptSecret('test-code-verifier'),
    });
    upsertConnection.mockImplementation(async (input) =>
      publicConnection({
        verified_file_key: input.verification.verifiedFileKey,
        verified_file_name: input.verification.verifiedFileName,
        verified_at: input.verification.verifiedAt,
        verification_error: input.verification.verificationError,
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('binds a short-lived PKCE state to the initiating user and project', async () => {
    const result = await service.startOAuth(USER_ID, PROJECT_ID);
    const url = new URL(result.url);
    const state = url.searchParams.get('state');

    expect(url.origin + url.pathname).toBe('https://www.figma.com/oauth');
    expect(url.searchParams.get('scope')).toBe('file_metadata:read');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(state).toBeTruthy();
    const payload = verifyOAuthState(state!, STATE_PURPOSE);
    expect(payload.userId).toBe(USER_ID);
    expect(payload.projectId).toBe(PROJECT_ID);
    expect(payload.exp - Date.now()).toBeLessThanOrEqual(5 * 60 * 1000);
    expect(createOAuthAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: PROJECT_ID,
        userId: USER_ID,
        nonceHash: expect.any(String),
        codeVerifierEnc: expect.stringMatching(/^v1:/),
      })
    );
  });

  it('rejects project isolation violations before creating an OAuth attempt', async () => {
    listAccessibleProjectIds.mockResolvedValue([OTHER_PROJECT_ID]);

    await expect(service.startOAuth(USER_ID, PROJECT_ID)).rejects.toThrow(
      'Unauthorized. You do not have permission to manage this project.'
    );
    expect(createOAuthAttempt).not.toHaveBeenCalled();
  });

  it('rejects invalid state before touching the one-time attempt store', async () => {
    await expect(
      service.handleOAuthCallback('auth-code', 'invalid-state')
    ).rejects.toThrow('Invalid or already used Figma OAuth state.');
    expect(consumeOAuthAttempt).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an already consumed state', async () => {
    const { state } = createOAuthStateWithPayload(USER_ID, STATE_PURPOSE, {
      projectId: PROJECT_ID,
    });
    consumeOAuthAttempt.mockResolvedValue(null);

    await expect(
      service.handleOAuthCallback('auth-code', state)
    ).rejects.toThrow('Invalid or already used Figma OAuth state.');
  });

  it('checks project permission again during the callback', async () => {
    const { state } = createOAuthStateWithPayload(USER_ID, STATE_PURPOSE, {
      projectId: PROJECT_ID,
    });
    listAccessibleProjectIds.mockResolvedValue([OTHER_PROJECT_ID]);

    await expect(
      service.handleOAuthCallback('auth-code', state)
    ).rejects.toThrow(
      'Unauthorized. You do not have permission to manage this project.'
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(upsertConnection).not.toHaveBeenCalled();
  });

  it('keeps the connection but reports denied access to the saved design', async () => {
    const { state } = createOAuthStateWithPayload(USER_ID, STATE_PURPOSE, {
      projectId: PROJECT_ID,
    });
    // The service decrypts the verifier before exchanging the code. Use a real
    // encrypted value from a fresh start attempt by capturing that call.
    await service.startOAuth(USER_ID, PROJECT_ID);
    const attemptInput = createOAuthAttempt.mock.calls.at(-1)![0];
    consumeOAuthAttempt.mockResolvedValue({
      id: 'attempt-1',
      project_id: PROJECT_ID,
      user_id: USER_ID,
      code_verifier_enc: attemptInput.codeVerifierEnc,
    });
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            user_id_string: 'figma-user-1',
            access_token: 'figma-access-token',
            refresh_token: 'figma-refresh-token',
            expires_in: 3600,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Forbidden' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    const result = await service.handleOAuthCallback('auth-code', state);

    expect(result.connected).toBe(true);
    expect(result.design_access_verified).toBe(false);
    expect(result.verification_error).toMatch(/cannot access/i);
    expect(upsertConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: PROJECT_ID,
        authorizedBy: USER_ID,
        accessTokenEnc: expect.stringMatching(/^v1:/),
        refreshTokenEnc: expect.stringMatching(/^v1:/),
        verification: expect.objectContaining({
          verifiedFileKey: null,
          verificationError: expect.stringMatching(/cannot access/i),
        }),
      })
    );
    const persisted = upsertConnection.mock.calls.at(-1)![0];
    expect(isEncryptedSecret(persisted.accessTokenEnc)).toBe(true);
    expect(persisted.accessTokenEnc).not.toContain('figma-access-token');
  });
});
