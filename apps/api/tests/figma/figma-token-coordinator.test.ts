import { FigmaOAuthCredentialStatus } from '@repo/types/prisma';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encryptSecret } from '../../src/lib/secrets/token-crypto';
import type {
  FigmaCanonicalCredentialFull,
  FigmaRepository,
} from '../../src/routes/api/figma/figma.repository';
import { FigmaTokenCoordinator } from '../../src/routes/api/figma/figma-token-coordinator';
import { encryptRefreshEnvelope } from '../../src/routes/api/figma/figma-recovery-envelope';
import {
  FigmaTokenClient,
  FigmaTokenOutcomeUnknownError,
} from '../../src/routes/api/figma/figma-token-client';

const now = new Date('2026-11-26T08:00:00.000Z');

function credential(overrides: Partial<FigmaCanonicalCredentialFull> = {}) {
  return {
    id: 'credential-1',
    oauth_app_key: 'figma:app',
    figma_user_id: 'figma-user-1',
    access_token_enc: encryptSecret('old-access-token'),
    refresh_token_enc: encryptSecret('refresh-token'),
    access_token_expires_at: new Date(now.getTime() - 1),
    scopes: 'file_metadata:read',
    status: FigmaOAuthCredentialStatus.active,
    token_version: 2,
    last_validated_at: now,
    last_authorized_by: 'user-1',
    created_at: now,
    updated_at: now,
    ...overrides,
  } satisfies FigmaCanonicalCredentialFull;
}

describe('FigmaTokenCoordinator', () => {
  const repository = {
    assertNoConflictingTokenOperation: vi.fn(),
    prepareAuthorizationCodeOperation: vi.fn(),
    prepareRefreshOperation: vi.fn(),
    markOperationRequesting: vi.fn(),
    recordOperationResponse: vi.fn(),
    recordOperationOutcomeUnknown: vi.fn(),
    recordOperationProviderRejected: vi.fn(),
    finalizeAuthorizationOperation: vi.fn(),
    finalizeRefreshOperation: vi.fn(),
    findCanonicalCredentialById: vi.fn(),
    findRecoverableAuthorizationOperation: vi.fn(),
    findRecoverableRefreshOperation: vi.fn(),
    recoverOverdueRequestingOperations: vi.fn(),
  } as unknown as FigmaRepository;
  const tokenClient = {
    exchangeAuthorizationCode: vi.fn(),
    refresh: vi.fn(),
  } as unknown as FigmaTokenClient;
  const withAppLock = vi.fn(async (_key, operation) =>
    operation(new AbortController().signal)
  );
  const coordinator = new FigmaTokenCoordinator(
    repository,
    tokenClient,
    withAppLock
  );

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.mocked(
      repository.findRecoverableAuthorizationOperation
    ).mockResolvedValue(null);
    vi.mocked(repository.findRecoverableRefreshOperation).mockResolvedValue(
      null
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('journals, encrypts, and finalizes one authorization-code exchange', async () => {
    vi.mocked(repository.prepareAuthorizationCodeOperation).mockResolvedValue({
      operation: {
        id: 'operation-1',
        journal_sequence: 1n,
      } as never,
      codeVerifierEnc: encryptSecret('pkce-verifier'),
    });
    vi.mocked(tokenClient.exchangeAuthorizationCode).mockResolvedValue({
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      expires_in: 3600,
      token_type: 'bearer',
      user_id_string: 'figma-user-1',
    });
    vi.mocked(repository.finalizeAuthorizationOperation).mockResolvedValue({
      credential: credential(),
      bound: true,
    });

    await expect(
      coordinator.exchangeAuthorizationCode(
        {
          oauthAppKey: 'figma:app',
          projectId: 'project-1',
          userId: 'user-1',
          nonceHash: 'nonce-hash',
          authorizationCode: 'authorization-code',
        },
        async () => true
      )
    ).resolves.toMatchObject({ bound: true });

    expect(repository.markOperationRequesting).toHaveBeenCalledOnce();
    const responseWrite = vi.mocked(repository.recordOperationResponse).mock
      .calls[0]![0];
    expect(responseWrite.encryptedEnvelope).toMatch(/^v1:/);
    expect(responseWrite.encryptedEnvelope).not.toContain('new-access-token');
    expect(repository.finalizeAuthorizationOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: 'operation-1',
        expectedEnvelopeEnc: responseWrite.encryptedEnvelope,
        allowProjectBinding: true,
      })
    );
  });

  it('marks a transport failure outcome unknown and does not finalize', async () => {
    vi.mocked(repository.findCanonicalCredentialById).mockResolvedValue(
      credential()
    );
    vi.mocked(repository.prepareRefreshOperation).mockResolvedValue({
      id: 'operation-2',
    } as never);
    vi.mocked(tokenClient.refresh).mockRejectedValue(
      new FigmaTokenOutcomeUnknownError()
    );

    await expect(
      coordinator.refreshCredential({
        oauthAppKey: 'figma:app',
        credentialId: 'credential-1',
        expectedTokenVersion: 2,
        force: true,
      })
    ).rejects.toBeInstanceOf(FigmaTokenOutcomeUnknownError);

    expect(repository.recordOperationOutcomeUnknown).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: 'operation-2',
        failureCode: 'transport_outcome_unknown',
      })
    );
    expect(repository.finalizeRefreshOperation).not.toHaveBeenCalled();
  });

  it('uses a newer canonical version without issuing another refresh', async () => {
    vi.mocked(repository.findCanonicalCredentialById).mockResolvedValue(
      credential({ token_version: 3 })
    );

    await expect(
      coordinator.refreshCredential({
        oauthAppKey: 'figma:app',
        credentialId: 'credential-1',
        expectedTokenVersion: 2,
        force: true,
      })
    ).resolves.toMatchObject({ token_version: 3 });

    expect(tokenClient.refresh).not.toHaveBeenCalled();
    expect(repository.prepareRefreshOperation).not.toHaveBeenCalled();
  });

  it('finalizes a persisted refresh response without another provider call', async () => {
    const encryptedEnvelope = encryptRefreshEnvelope({
      access_token: 'recovered-access-token',
      expires_in: 3600,
      token_type: 'bearer',
    });
    vi.mocked(repository.findCanonicalCredentialById).mockResolvedValue(
      credential()
    );
    vi.mocked(repository.findRecoverableRefreshOperation).mockResolvedValue({
      id: 'operation-3',
      pending_token_response_enc: encryptedEnvelope,
      pending_access_token_expires_at: new Date(now.getTime() + 3_600_000),
      pending_scopes: 'file_metadata:read',
    } as never);
    vi.mocked(repository.finalizeRefreshOperation).mockResolvedValue(
      credential({ token_version: 3 })
    );

    await coordinator.refreshCredential({
      oauthAppKey: 'figma:app',
      credentialId: 'credential-1',
      expectedTokenVersion: 2,
      force: true,
    });

    expect(tokenClient.refresh).not.toHaveBeenCalled();
    expect(repository.finalizeRefreshOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: 'operation-3',
        expectedEnvelopeEnc: encryptedEnvelope,
        accessTokenEnc: expect.stringMatching(/^v1:/),
      })
    );
  });
});
