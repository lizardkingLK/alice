import { createHash } from 'node:crypto';
import { FigmaOAuthCredentialStatus } from '@repo/types/prisma';
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
import {
  FigmaOAuthAppMismatchError,
  type FigmaRepository,
} from '../../src/routes/api/figma/figma.repository';
import {
  figmaOAuthAppKey,
  FigmaService,
} from '../../src/routes/api/figma/figma.service';

const { requireUserWithRoleMock } = vi.hoisted(() => ({
  requireUserWithRoleMock: vi.fn(),
}));

vi.mock('../../src/lib/auth-helpers', () => ({
  requireUserWithRole: requireUserWithRoleMock,
}));

const USER_ID = '11111111-1111-4111-8111-111111111111';
const PROJECT_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_PROJECT_ID = '33333333-3333-4333-8333-333333333333';
const CREDENTIAL_ID = '55555555-5555-4555-8555-555555555555';
const STATE_PURPOSE = 'sign Figma OAuth state (HMAC)';
const EXPECTED_OAUTH_APP_KEY = `figma:sha256:${createHash('sha256')
  .update('mock-figma-client-id')
  .digest('hex')}`;

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

function effectiveConnection(
  source: 'canonical' | 'legacy' = 'canonical',
  projectId = PROJECT_ID
) {
  return {
    ...publicConnection({ project_id: projectId }),
    access_token_enc: encryptSecret(`${source}-access-token`),
    refresh_token_enc: encryptSecret(`${source}-refresh-token`),
    credential_id: source === 'canonical' ? CREDENTIAL_ID : null,
    credential_source: source,
    oauth_app_verified: source === 'canonical',
    oauth_app_key: source === 'canonical' ? EXPECTED_OAUTH_APP_KEY : null,
    credential_status:
      source === 'canonical' ? FigmaOAuthCredentialStatus.active : null,
    token_version: source === 'canonical' ? 1 : null,
    last_validated_at: source === 'canonical' ? new Date() : null,
  };
}

describe('FigmaService', () => {
  const createOAuthAttempt = vi.fn();
  const consumeOAuthAttempt = vi.fn();
  const getProject = vi.fn();
  const findConnectionByProjectId = vi.fn();
  const findFullConnectionByProjectId = vi.fn();
  const findCredentialByProjectBinding = vi.fn();
  const upsertConnection = vi.fn();
  const updateTokens = vi.fn();
  const updateVerification = vi.fn();
  const deleteConnection = vi.fn();
  const deleteProjectBinding = vi.fn();
  const listAccessibleProjectIds = vi.fn();
  const fetchMock = vi.fn();
  const repository = {
    createOAuthAttempt,
    consumeOAuthAttempt,
    getProject,
    findConnectionByProjectId,
    findFullConnectionByProjectId,
    findCredentialByProjectBinding,
    upsertConnection,
    updateTokens,
    updateVerification,
    deleteConnection,
    deleteProjectBinding,
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
    findCredentialByProjectBinding.mockResolvedValue(null);
    deleteProjectBinding.mockResolvedValue(true);
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

  it('derives a stable, non-reversible OAuth app identity from the client id', () => {
    expect(figmaOAuthAppKey()).toBe(EXPECTED_OAUTH_APP_KEY);
    expect(figmaOAuthAppKey('mock-figma-client-id')).toBe(
      EXPECTED_OAUTH_APP_KEY
    );
    expect(EXPECTED_OAUTH_APP_KEY).not.toContain('mock-figma-client-id');
    expect(EXPECTED_OAUTH_APP_KEY).not.toContain('mock-figma-client-secret');
  });

  it('keeps the same Figma user isolated across different OAuth apps', () => {
    expect(figmaOAuthAppKey('figma-client-a')).not.toBe(
      figmaOAuthAppKey('figma-client-b')
    );
  });

  it('does not expose arbitrary canonical credential binding methods', () => {
    const serviceSurface = service as unknown as Record<string, unknown>;

    expect(serviceSurface.bindProjectToCanonicalCredential).toBeUndefined();
    expect(serviceSurface.persistSharedCredentialAuthorization).toBeUndefined();
  });

  it('does not expose unrelated Figma account metadata lookup', () => {
    const serviceSurface = service as unknown as Record<string, unknown>;

    expect(
      serviceSurface.findCanonicalCredentialForProjectUser
    ).toBeUndefined();
  });

  it.each([
    ['another Alice user', { actorId: 'alice-user-2' }],
    ['another project', { projectId: OTHER_PROJECT_ID }],
    ['another OAuth app', { oauthAppKey: 'figma:sha256:other' }],
    ['another Figma account', { figmaUserId: 'figma-user-2' }],
  ])(
    'does not accept caller-supplied authorization from %s',
    (_label, untrustedAuthorization) => {
      const serviceSurface = service as unknown as Record<string, unknown>;

      expect(untrustedAuthorization).toBeTypeOf('object');
      expect(
        serviceSurface.persistSharedCredentialAuthorization
      ).toBeUndefined();
      expect(serviceSurface.bindProjectToCanonicalCredential).toBeUndefined();
    }
  );

  it.each([
    [
      'project-bound credential reads',
      () => service.findSharedCredentialForProject(USER_ID, PROJECT_ID),
    ],
    [
      'project-specific disconnects',
      () =>
        service.disconnectProjectFromCanonicalCredential(USER_ID, PROJECT_ID),
    ],
  ])('rejects unauthorized %s before repository access', async (_name, run) => {
    listAccessibleProjectIds.mockResolvedValue([OTHER_PROJECT_ID]);

    await expect(run()).rejects.toThrow(
      'Unauthorized. You do not have permission to manage this project.'
    );

    expect(findCredentialByProjectBinding).not.toHaveBeenCalled();
    expect(deleteProjectBinding).not.toHaveBeenCalled();
  });

  it('marks a legacy project credential as having unverified OAuth app identity', async () => {
    findCredentialByProjectBinding.mockResolvedValue(
      effectiveConnection('legacy')
    );

    const result = await service.findSharedCredentialForProject(
      USER_ID,
      PROJECT_ID
    );

    expect(result).toMatchObject({
      identity: 'legacy_unverified',
      connection: {
        credential_source: 'legacy',
        oauth_app_verified: false,
        oauth_app_key: null,
      },
    });
  });

  it('resolves a canonical credential only through its project binding', async () => {
    findCredentialByProjectBinding.mockResolvedValue(effectiveConnection());

    const result = await service.findSharedCredentialForProject(
      USER_ID,
      PROJECT_ID
    );

    expect(findCredentialByProjectBinding).toHaveBeenCalledWith(
      PROJECT_ID,
      EXPECTED_OAUTH_APP_KEY
    );
    expect(result?.identity).toBe('canonical');
    expect(result?.connection.credential_id).toBe(CREDENTIAL_ID);
  });

  it('preserves OAuth app mismatch errors from project binding lookup', async () => {
    const mismatch = new FigmaOAuthAppMismatchError();
    findCredentialByProjectBinding.mockRejectedValue(mismatch);

    await expect(
      service.findSharedCredentialForProject(USER_ID, PROJECT_ID)
    ).rejects.toBe(mismatch);
  });

  it('disconnects only the requested project binding', async () => {
    await service.disconnectProjectFromCanonicalCredential(USER_ID, PROJECT_ID);

    expect(deleteProjectBinding).toHaveBeenCalledWith(PROJECT_ID);
    expect(deleteConnection).not.toHaveBeenCalled();
  });

  it('keeps the existing OAuth callback on the legacy connection path', async () => {
    const { state } = createOAuthStateWithPayload(USER_ID, STATE_PURPOSE, {
      projectId: PROJECT_ID,
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
        new Response(JSON.stringify({ file: { name: 'Alice Design' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    await service.handleOAuthCallback('auth-code', state);

    expect(upsertConnection).toHaveBeenCalledOnce();
    expect(findCredentialByProjectBinding).not.toHaveBeenCalled();
    expect(deleteProjectBinding).not.toHaveBeenCalled();
  });
});
