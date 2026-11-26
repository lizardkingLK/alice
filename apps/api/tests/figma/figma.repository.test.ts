import {
  FigmaOAuthCredentialStatus,
  FigmaOAuthOperationResolution,
} from '@repo/types/prisma';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  connectionDeleteManyMock,
  connectionFindUniqueMock,
  transactionConnectionFindUniqueMock,
  connectionUpsertMock,
  credentialCreateMock,
  credentialFindUniqueMock,
  attemptFindFirstMock,
  attemptUpdateManyMock,
  executeRawMock,
  transactionMock,
  projectUpdateMock,
  operationUpdateManyMock,
  operationFindFirstMock,
  operationFindManyMock,
  credentialUpdateManyMock,
} = vi.hoisted(() => ({
  connectionDeleteManyMock: vi.fn(),
  connectionFindUniqueMock: vi.fn(),
  transactionConnectionFindUniqueMock: vi.fn(),
  connectionUpsertMock: vi.fn(),
  credentialCreateMock: vi.fn(),
  credentialFindUniqueMock: vi.fn(),
  attemptFindFirstMock: vi.fn(),
  attemptUpdateManyMock: vi.fn(),
  // GI-666: advisory-lock helper now uses $executeRaw (not $queryRaw) so that
  // Prisma does not attempt to deserialize the void result returned by
  // pg_advisory_xact_lock().
  executeRawMock: vi.fn(),
  transactionMock: vi.fn(),
  projectUpdateMock: vi.fn(),
  operationUpdateManyMock: vi.fn(),
  operationFindFirstMock: vi.fn(),
  operationFindManyMock: vi.fn(),
  credentialUpdateManyMock: vi.fn(),
}));

const transactionClient = {
  $executeRaw: executeRawMock,
  figma_oauth_credentials: {
    create: credentialCreateMock,
    findUnique: credentialFindUniqueMock,
    updateMany: credentialUpdateManyMock,
  },
  figma_connections: {
    deleteMany: connectionDeleteManyMock,
    findUnique: transactionConnectionFindUniqueMock,
    upsert: connectionUpsertMock,
  },
  figma_oauth_attempts: {
    findFirst: attemptFindFirstMock,
    updateMany: attemptUpdateManyMock,
  },
  projects: {
    update: projectUpdateMock,
  },
  figma_oauth_operations: {
    findFirst: operationFindFirstMock,
    findMany: operationFindManyMock,
    updateMany: operationUpdateManyMock,
  },
};

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    $transaction: transactionMock,
    figma_oauth_credentials: {
      findUnique: credentialFindUniqueMock,
    },
    figma_connections: {
      deleteMany: connectionDeleteManyMock,
      findUnique: connectionFindUniqueMock,
    },
    figma_oauth_operations: {
      updateMany: operationUpdateManyMock,
    },
  },
}));

import {
  FigmaCredentialReplacementDeferredError,
  FigmaCredentialVersionConflictError,
  FigmaOAuthAppMismatchError,
  FigmaRepository,
  type FigmaCanonicalCredentialFull,
  type FigmaCanonicalCredentialMetadata,
  type FigmaConnectionPublic,
  type UpsertFigmaCredentialAndBindingInput,
} from '../../src/routes/api/figma/figma.repository';

const now = new Date('2026-11-25T06:00:00.000Z');
const expiresAt = new Date('2026-11-25T07:00:00.000Z');

function publicConnection(projectId: string): FigmaConnectionPublic {
  return {
    id: `connection-${projectId}`,
    project_id: projectId,
    authorized_by: 'alice-user-1',
    figma_user_id: 'figma-user-1',
    scopes: 'file_metadata:read',
    access_token_expires_at: expiresAt,
    verified_file_key: 'file-key-1',
    verified_file_name: 'Design system',
    verified_at: now,
    verification_error: null,
    created_at: now,
    updated_at: now,
    authorized_by_user: { id: 'alice-user-1', name: 'Alice Manager' },
  };
}

function credentialMetadata(
  id = 'credential-1',
  figmaUserId = 'figma-user-1'
): FigmaCanonicalCredentialMetadata {
  return {
    id,
    oauth_app_key: 'figma-app:client-1',
    figma_user_id: figmaUserId,
    access_token_expires_at: expiresAt,
    scopes: 'file_metadata:read',
    status: FigmaOAuthCredentialStatus.active,
    token_version: 2,
    last_validated_at: now,
    last_authorized_by: 'alice-user-1',
    created_at: now,
    updated_at: now,
  };
}

function fullCredential(
  id = 'credential-1',
  figmaUserId = 'figma-user-1'
): FigmaCanonicalCredentialFull {
  return {
    ...credentialMetadata(id, figmaUserId),
    access_token_enc: `canonical-access-${id}`,
    refresh_token_enc: `canonical-refresh-${id}`,
  };
}

function authorizationInput(
  overrides: Partial<UpsertFigmaCredentialAndBindingInput> = {}
): UpsertFigmaCredentialAndBindingInput {
  return {
    oauthAppKey: 'figma-app:client-1',
    projectId: 'project-1',
    authorizedBy: 'alice-user-1',
    figmaUserId: 'figma-user-1',
    accessTokenEnc: 'new-access-ciphertext',
    refreshTokenEnc: 'new-refresh-ciphertext',
    accessTokenExpiresAt: expiresAt,
    scopes: 'file_metadata:read',
    status: FigmaOAuthCredentialStatus.active,
    expectedTokenVersion: null,
    lastValidatedAt: now,
    verification: {
      verifiedFileKey: 'file-key-1',
      verifiedFileName: 'Design system',
      verifiedAt: now,
      verificationError: null,
    },
    ...overrides,
  };
}

describe('FigmaRepository shared credentials', () => {
  const repository = new FigmaRepository();

  beforeEach(() => {
    vi.clearAllMocks();
    transactionMock.mockImplementation(
      async (operation: (tx: typeof transactionClient) => unknown) =>
        operation(transactionClient)
    );
    executeRawMock.mockResolvedValue(0); // GI-666: $executeRaw returns row count, not void column array;
    transactionConnectionFindUniqueMock.mockResolvedValue(null);
  });

  it('finds one canonical credential by OAuth app and Figma user identity', async () => {
    credentialFindUniqueMock.mockResolvedValue(fullCredential());

    await expect(
      repository.findCanonicalCredentialByIdentity(
        'figma-app:client-1',
        'figma-user-1'
      )
    ).resolves.toMatchObject({ id: 'credential-1' });

    expect(credentialFindUniqueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          oauth_app_key_figma_user_id: {
            oauth_app_key: 'figma-app:client-1',
            figma_user_id: 'figma-user-1',
          },
        },
      })
    );
  });

  it('preserves existing attempt consumption for a non-null verifier', async () => {
    attemptFindFirstMock.mockResolvedValue({
      id: 'attempt-1',
      project_id: 'project-1',
      user_id: 'alice-user-1',
      code_verifier_enc: 'v1:encrypted-verifier',
    });
    attemptUpdateManyMock.mockResolvedValue({ count: 1 });

    await expect(
      repository.consumeOAuthAttempt({
        projectId: 'project-1',
        userId: 'alice-user-1',
        nonceHash: 'nonce-hash',
      })
    ).resolves.toMatchObject({
      id: 'attempt-1',
      code_verifier_enc: 'v1:encrypted-verifier',
    });

    expect(attemptUpdateManyMock).toHaveBeenCalledOnce();
  });

  it('rejects an unexpected null verifier without consuming the attempt', async () => {
    attemptFindFirstMock.mockResolvedValue({
      id: 'attempt-1',
      project_id: 'project-1',
      user_id: 'alice-user-1',
      code_verifier_enc: null,
    });

    await expect(
      repository.consumeOAuthAttempt({
        projectId: 'project-1',
        userId: 'alice-user-1',
        nonceHash: 'nonce-hash',
      })
    ).resolves.toBeNull();

    expect(attemptUpdateManyMock).not.toHaveBeenCalled();
  });

  it('prefers canonical tokens while preserving project verification fields', async () => {
    connectionFindUniqueMock.mockResolvedValue({
      ...publicConnection('project-1'),
      credential_id: 'credential-1',
      access_token_enc: 'stale-legacy-access',
      refresh_token_enc: 'stale-legacy-refresh',
      credential: fullCredential(),
    });

    const result = await repository.findCredentialByProjectBinding(
      'project-1',
      'figma-app:client-1'
    );

    expect(result).toMatchObject({
      credential_id: 'credential-1',
      credential_source: 'canonical',
      oauth_app_verified: true,
      access_token_enc: 'canonical-access-credential-1',
      refresh_token_enc: 'canonical-refresh-credential-1',
      verified_file_key: 'file-key-1',
      verified_file_name: 'Design system',
      authorized_by: 'alice-user-1',
    });
  });

  it('rejects a project credential issued by another OAuth app', async () => {
    connectionFindUniqueMock.mockResolvedValue({
      ...publicConnection('project-1'),
      credential_id: 'credential-1',
      access_token_enc: 'legacy-access',
      refresh_token_enc: 'legacy-refresh',
      credential: fullCredential(),
    });

    await expect(
      repository.findCredentialByProjectBinding(
        'project-1',
        'figma-app:client-2'
      )
    ).rejects.toBeInstanceOf(FigmaOAuthAppMismatchError);
  });

  it('falls back to legacy credentials for an unbackfilled connection', async () => {
    connectionFindUniqueMock.mockResolvedValue({
      ...publicConnection('legacy-project'),
      credential_id: null,
      access_token_enc: 'legacy-access',
      refresh_token_enc: 'legacy-refresh',
      credential: null,
    });

    const result = await repository.findCredentialByProjectBinding(
      'legacy-project',
      'figma-app:client-1'
    );

    expect(result).toMatchObject({
      credential_id: null,
      credential_source: 'legacy',
      oauth_app_verified: false,
      access_token_enc: 'legacy-access',
      refresh_token_enc: 'legacy-refresh',
      oauth_app_key: null,
      token_version: null,
    });
  });

  it('binds two projects to one credential and keeps legacy columns populated', async () => {
    credentialFindUniqueMock.mockResolvedValue(fullCredential());
    connectionUpsertMock
      .mockResolvedValueOnce(publicConnection('project-1'))
      .mockResolvedValueOnce(publicConnection('project-2'));

    await repository.upsertProjectCredentialBinding({
      credentialId: 'credential-1',
      expectedOAuthAppKey: 'figma-app:client-1',
      projectId: 'project-1',
      authorizedBy: 'alice-user-1',
    });
    await repository.upsertProjectCredentialBinding({
      credentialId: 'credential-1',
      expectedOAuthAppKey: 'figma-app:client-1',
      projectId: 'project-2',
      authorizedBy: 'alice-user-2',
    });

    expect(connectionUpsertMock).toHaveBeenCalledTimes(2);
    for (const call of connectionUpsertMock.mock.calls) {
      expect(call[0].create).toMatchObject({
        credential_id: 'credential-1',
        access_token_enc: 'canonical-access-credential-1',
        refresh_token_enc: 'canonical-refresh-credential-1',
      });
      expect(call[0].update).not.toHaveProperty('verified_file_key');
      expect(call[0].update).not.toHaveProperty('verified_file_name');
      expect(call[0].update).not.toHaveProperty('verified_at');
      expect(call[0].update).not.toHaveProperty('verification_error');
    }
    expect(connectionUpsertMock.mock.calls[0]?.[0].where).toEqual({
      project_id: 'project-1',
    });
    expect(connectionUpsertMock.mock.calls[1]?.[0].where).toEqual({
      project_id: 'project-2',
    });
  });

  it('clears project verification atomically when the credential changes', async () => {
    credentialFindUniqueMock.mockResolvedValue(
      fullCredential('credential-2', 'figma-user-2')
    );
    transactionConnectionFindUniqueMock.mockResolvedValue({
      credential_id: 'credential-1',
    });
    connectionUpsertMock.mockResolvedValue(publicConnection('project-1'));

    await repository.upsertProjectCredentialBinding({
      credentialId: 'credential-2',
      expectedOAuthAppKey: 'figma-app:client-1',
      projectId: 'project-1',
      authorizedBy: 'alice-user-1',
    });

    expect(transactionConnectionFindUniqueMock).toHaveBeenCalledWith({
      where: { project_id: 'project-1' },
      select: { credential_id: true },
    });
    expect(executeRawMock.mock.invocationCallOrder.at(-1)).toBeLessThan(
      transactionConnectionFindUniqueMock.mock.invocationCallOrder[0] ?? 0
    );
    expect(connectionUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          credential_id: 'credential-2',
          verified_file_key: null,
          verified_file_name: null,
          verified_at: null,
          verification_error: null,
        }),
      })
    );
    const update = connectionUpsertMock.mock.calls[0]?.[0].update;
    expect(update).not.toHaveProperty('figma_url');
  });

  it('preserves applicable verification when the same credential remains bound', async () => {
    credentialFindUniqueMock.mockResolvedValue(fullCredential());
    transactionConnectionFindUniqueMock.mockResolvedValue({
      credential_id: 'credential-1',
    });
    connectionUpsertMock.mockResolvedValue(publicConnection('project-1'));

    await repository.upsertProjectCredentialBinding({
      credentialId: 'credential-1',
      expectedOAuthAppKey: 'figma-app:client-1',
      projectId: 'project-1',
      authorizedBy: 'alice-user-1',
    });

    const update = connectionUpsertMock.mock.calls[0]?.[0].update;
    expect(update).not.toHaveProperty('verified_file_key');
    expect(update).not.toHaveProperty('verified_file_name');
    expect(update).not.toHaveProperty('verified_at');
    expect(update).not.toHaveProperty('verification_error');
    expect(update).not.toHaveProperty('figma_url');
  });

  it('stores fresh verification supplied after a credential change', async () => {
    credentialFindUniqueMock.mockResolvedValue(
      fullCredential('credential-2', 'figma-user-2')
    );
    transactionConnectionFindUniqueMock.mockResolvedValue({
      credential_id: 'credential-1',
    });
    connectionUpsertMock.mockResolvedValue(publicConnection('project-1'));

    await repository.upsertProjectCredentialBinding({
      credentialId: 'credential-2',
      expectedOAuthAppKey: 'figma-app:client-1',
      projectId: 'project-1',
      authorizedBy: 'alice-user-1',
      verification: {
        verifiedFileKey: 'file-key-2',
        verifiedFileName: 'New account design',
        verifiedAt: now,
        verificationError: null,
      },
    });

    expect(connectionUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          credential_id: 'credential-2',
          verified_file_key: 'file-key-2',
          verified_file_name: 'New account design',
          verified_at: now,
          verification_error: null,
        }),
      })
    );
  });

  it('rejects binding a credential from another OAuth app', async () => {
    credentialFindUniqueMock.mockResolvedValue(fullCredential());

    await expect(
      repository.upsertProjectCredentialBinding({
        credentialId: 'credential-1',
        expectedOAuthAppKey: 'figma-app:client-2',
        projectId: 'project-1',
        authorizedBy: 'alice-user-1',
      })
    ).rejects.toBeInstanceOf(FigmaOAuthAppMismatchError);

    expect(executeRawMock).toHaveBeenCalledOnce();
    expect(connectionUpsertMock).not.toHaveBeenCalled();
  });

  it('locks before reading tokens copied into a project binding', async () => {
    credentialFindUniqueMock.mockResolvedValue(fullCredential());
    connectionUpsertMock.mockResolvedValue(publicConnection('project-1'));

    await repository.upsertProjectCredentialBinding({
      credentialId: 'credential-1',
      expectedOAuthAppKey: 'figma-app:client-1',
      projectId: 'project-1',
      authorizedBy: 'alice-user-1',
    });

    expect(executeRawMock).toHaveBeenCalledTimes(2);
    expect(executeRawMock).toHaveBeenCalledBefore(credentialFindUniqueMock);
    expect(executeRawMock.mock.invocationCallOrder.at(-1)).toBeLessThan(
      connectionUpsertMock.mock.invocationCallOrder[0] ?? 0
    );
    expect(connectionUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          access_token_enc: 'canonical-access-credential-1',
          refresh_token_enc: 'canonical-refresh-credential-1',
        }),
      })
    );
  });

  it('keeps different Figma accounts in separate canonical credentials', async () => {
    credentialFindUniqueMock.mockResolvedValue(null);
    credentialCreateMock
      .mockResolvedValueOnce(credentialMetadata('credential-1', 'figma-user-1'))
      .mockResolvedValueOnce(
        credentialMetadata('credential-2', 'figma-user-2')
      );
    connectionUpsertMock
      .mockResolvedValueOnce(publicConnection('project-1'))
      .mockResolvedValueOnce(publicConnection('project-2'));

    await repository.upsertCredentialAndProjectBinding(authorizationInput());
    await repository.upsertCredentialAndProjectBinding(
      authorizationInput({
        projectId: 'project-2',
        figmaUserId: 'figma-user-2',
      })
    );

    expect(credentialCreateMock.mock.calls[0]?.[0].data).toMatchObject({
      oauth_app_key: 'figma-app:client-1',
      figma_user_id: 'figma-user-1',
    });
    expect(credentialCreateMock.mock.calls[1]?.[0].data).toMatchObject({
      oauth_app_key: 'figma-app:client-1',
      figma_user_id: 'figma-user-2',
    });
  });

  it('does not share one Figma account across different OAuth apps', async () => {
    credentialFindUniqueMock.mockResolvedValue(null);
    credentialCreateMock
      .mockResolvedValueOnce(credentialMetadata('credential-app-1'))
      .mockResolvedValueOnce(credentialMetadata('credential-app-2'));
    connectionUpsertMock
      .mockResolvedValueOnce(publicConnection('project-1'))
      .mockResolvedValueOnce(publicConnection('project-2'));

    await repository.upsertCredentialAndProjectBinding(authorizationInput());
    await repository.upsertCredentialAndProjectBinding(
      authorizationInput({
        oauthAppKey: 'figma-app:client-2',
        projectId: 'project-2',
      })
    );

    expect(credentialCreateMock.mock.calls[0]?.[0].data).toMatchObject({
      oauth_app_key: 'figma-app:client-1',
      figma_user_id: 'figma-user-1',
    });
    expect(credentialCreateMock.mock.calls[1]?.[0].data).toMatchObject({
      oauth_app_key: 'figma-app:client-2',
      figma_user_id: 'figma-user-1',
    });
  });

  it('rejects a stale token version inside the protected transaction', async () => {
    credentialFindUniqueMock
      .mockResolvedValueOnce({ id: 'credential-1' })
      .mockResolvedValueOnce(credentialMetadata());

    await expect(
      repository.upsertCredentialAndProjectBinding(
        authorizationInput({ expectedTokenVersion: 1 })
      )
    ).rejects.toBeInstanceOf(FigmaCredentialVersionConflictError);

    expect(executeRawMock).toHaveBeenCalledTimes(2);
    expect(credentialCreateMock).not.toHaveBeenCalled();
    expect(connectionUpsertMock).not.toHaveBeenCalled();
  });

  it('defers replacement even when the expected token version is current', async () => {
    credentialFindUniqueMock
      .mockResolvedValueOnce({ id: 'credential-1' })
      .mockResolvedValueOnce(credentialMetadata());

    await expect(
      repository.upsertCredentialAndProjectBinding(
        authorizationInput({ expectedTokenVersion: 2 })
      )
    ).rejects.toBeInstanceOf(FigmaCredentialReplacementDeferredError);

    expect(credentialCreateMock).not.toHaveBeenCalled();
    expect(connectionUpsertMock).not.toHaveBeenCalled();
  });

  it('writes a new credential and binding in one protected transaction', async () => {
    credentialFindUniqueMock.mockResolvedValue(null);
    credentialCreateMock.mockResolvedValue(credentialMetadata());
    connectionUpsertMock.mockResolvedValue(publicConnection('project-1'));

    const result =
      await repository.upsertCredentialAndProjectBinding(authorizationInput());

    expect(transactionMock).toHaveBeenCalledOnce();
    expect(executeRawMock).toHaveBeenCalledTimes(2);
    expect(executeRawMock).toHaveBeenCalledBefore(credentialFindUniqueMock);
    expect(credentialFindUniqueMock).toHaveBeenCalledBefore(
      credentialCreateMock
    );
    expect(credentialCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          access_token_enc: 'new-access-ciphertext',
          refresh_token_enc: 'new-refresh-ciphertext',
        }),
      })
    );
    expect(connectionUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          credential_id: 'credential-1',
          verified_file_key: 'file-key-1',
        }),
      })
    );
    expect(result.credential).not.toHaveProperty('access_token_enc');
    expect(result.credential).not.toHaveProperty('refresh_token_enc');
  });

  it('propagates a binding failure from the atomic transaction', async () => {
    credentialFindUniqueMock.mockResolvedValue(null);
    credentialCreateMock.mockResolvedValue(credentialMetadata());
    connectionUpsertMock.mockRejectedValue(new Error('binding failed'));

    await expect(
      repository.upsertCredentialAndProjectBinding(authorizationInput())
    ).rejects.toThrow('binding failed');

    expect(transactionMock).toHaveBeenCalledOnce();
  });

  it('deletes only the requested project binding', async () => {
    connectionDeleteManyMock.mockResolvedValue({ count: 1 });

    await expect(repository.deleteProjectBinding('project-1')).resolves.toBe(
      true
    );

    expect(connectionDeleteManyMock).toHaveBeenCalledWith({
      where: { project_id: 'project-1' },
    });
    expect(projectUpdateMock).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: { figma_binding_generation: { increment: 1 } },
    });
    expect(credentialFindUniqueMock).not.toHaveBeenCalled();
    expect(credentialCreateMock).not.toHaveBeenCalled();
  });

  it('requires the exact worker token for a response transition', async () => {
    operationUpdateManyMock.mockResolvedValue({ count: 1 });

    await repository.recordOperationResponse({
      operationId: 'operation-1',
      workerToken: '55555555-5555-4555-8555-555555555555',
      encryptedEnvelope: 'v1:encrypted-envelope',
      envelopeKeyVersion: 1,
      accessTokenExpiresAt: expiresAt,
      pendingScopes: 'file_metadata:read',
      envelopeExpiresAt: expiresAt,
      providerHttpStatus: 200,
      figmaUserId: 'figma-user-1',
    });

    expect(operationUpdateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'operation-1',
          status: 'requesting',
          worker_token: '55555555-5555-4555-8555-555555555555',
        },
        data: expect.objectContaining({
          status: 'response_received',
          worker_token: null,
          pending_token_response_enc: 'v1:encrypted-envelope',
        }),
      })
    );
  });

  it('rejects a stale worker transition that updates no row', async () => {
    operationUpdateManyMock.mockResolvedValue({ count: 0 });
    operationFindFirstMock.mockResolvedValue({ credential_id: null });

    await expect(
      repository.recordOperationOutcomeUnknown({
        operationId: 'operation-1',
        workerToken: '66666666-6666-4666-8666-666666666666',
        failureCode: 'transport_outcome_unknown',
      })
    ).rejects.toThrow('stale or is owned by another worker');
  });

  it('marks the affected credential unknown for an ambiguous refresh', async () => {
    operationFindFirstMock.mockResolvedValue({
      credential_id: 'credential-1',
    });
    operationUpdateManyMock.mockResolvedValue({ count: 1 });

    await repository.recordOperationOutcomeUnknown({
      operationId: 'operation-1',
      workerToken: '77777777-7777-4777-8777-777777777777',
      failureCode: 'transport_outcome_unknown',
    });

    expect(credentialUpdateManyMock).toHaveBeenCalledWith({
      where: { id: 'credential-1' },
      data: { status: FigmaOAuthCredentialStatus.unknown },
    });
  });

  it('resolves ambiguity only from outcome_unknown and fences the credential', async () => {
    operationFindFirstMock.mockResolvedValue({
      credential_id: 'credential-1',
      kind: 'token_refresh',
    });
    operationUpdateManyMock.mockResolvedValue({ count: 1 });

    await repository.resolveAmbiguousOperation({
      operationId: 'operation-1',
      oauthAppKey: 'figma-app:client-1',
      resolution: FigmaOAuthOperationResolution.provider_access_revoked,
      resolvedBy: 'alice-admin-1',
    });

    expect(credentialUpdateManyMock).toHaveBeenCalledWith({
      where: { id: 'credential-1' },
      data: {
        status: FigmaOAuthCredentialStatus.reauthorization_required,
      },
    });
    expect(operationUpdateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'outcome_unknown' }),
        data: expect.objectContaining({
          status: 'superseded',
          resolution: 'provider_access_revoked',
          resolved_by: 'alice-admin-1',
        }),
      })
    );
  });

  it('turns an overdue requesting worker into a durable ambiguity barrier', async () => {
    operationFindManyMock.mockResolvedValue([
      { credential_id: 'credential-1' },
    ]);
    operationUpdateManyMock.mockResolvedValue({ count: 1 });

    await repository.recoverOverdueRequestingOperations('figma-app:client-1');

    expect(operationUpdateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          oauth_app_key: 'figma-app:client-1',
          status: 'requesting',
        }),
        data: expect.objectContaining({
          status: 'outcome_unknown',
          worker_token: null,
          failure_code: 'worker_deadline_exceeded',
        }),
      })
    );
    expect(credentialUpdateManyMock).toHaveBeenCalledWith({
      where: { id: { in: ['credential-1'] } },
      data: { status: FigmaOAuthCredentialStatus.unknown },
    });
  });

  it('keeps encrypted credential fields out of public connection reads', async () => {
    connectionFindUniqueMock.mockResolvedValue(publicConnection('project-1'));

    const result = await repository.findConnectionByProjectId('project-1');
    const query = connectionFindUniqueMock.mock.calls[0]?.[0];

    expect(result).not.toHaveProperty('access_token_enc');
    expect(result).not.toHaveProperty('refresh_token_enc');
    expect(query.select).not.toHaveProperty('access_token_enc');
    expect(query.select).not.toHaveProperty('refresh_token_enc');
    expect(query.select).not.toHaveProperty('credential');
  });

  // GI-666 regression: pg_advisory_xact_lock() returns void. Prisma's
  // $queryRaw tries to deserialize columns and throws
  // "Failed to deserialize column of type 'void'". The advisory-lock helper
  // must use $executeRaw, which discards the result set entirely.
  it('uses $executeRaw (not $queryRaw) for advisory locks so void results are never deserialized', async () => {
    credentialFindUniqueMock.mockResolvedValue(null);
    credentialCreateMock.mockResolvedValue(credentialMetadata());
    connectionUpsertMock.mockResolvedValue(publicConnection('project-1'));

    await repository.upsertCredentialAndProjectBinding(authorizationInput());

    // $executeRaw must have been called (advisory lock)
    expect(executeRawMock).toHaveBeenCalled();
    // The transaction client must NOT have $queryRaw defined — if the
    // implementation regresses to $queryRaw, the call would throw because
    // the mock client does not expose it, surfacing the bug early.
    expect(transactionClient).not.toHaveProperty('$queryRaw');
  });
});
