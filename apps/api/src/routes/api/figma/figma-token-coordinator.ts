import { createHash, randomUUID } from 'node:crypto';
import type { FigmaOAuthOperationResolution } from '@repo/types/prisma';
import {
  connectionStringForPgAdapter,
  getPostgresPool,
  postgresAdvisoryLockConnectionMode,
  withPostgresSessionAdvisoryLock,
} from '@repo/db';
import { env } from '../../../config/env';
import {
  decryptSecret,
  encryptSecret,
} from '../../../lib/secrets/token-crypto';
import {
  FigmaOAuthOperationStaleError,
  type FigmaCanonicalCredentialFull,
  type FigmaCanonicalCredentialMetadata,
  type FigmaRepository,
  type PreparedFigmaOAuthOperation,
} from './figma.repository';
import {
  decryptRecoveryEnvelope,
  encryptAuthorizationEnvelope,
  encryptRefreshEnvelope,
  FIGMA_RECOVERY_ENVELOPE_KEY_VERSION,
} from './figma-recovery-envelope';
import {
  FigmaTokenClient,
  FigmaTokenInvalidResponseError,
  FigmaTokenOutcomeUnknownError,
  FigmaTokenProviderRejectedError,
} from './figma-token-client';

const REQUEST_DEADLINE_MS = 15_000;
const JOURNAL_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const ENVELOPE_RETENTION_MS = 24 * 60 * 60 * 1000;
const TOKEN_EXPIRY_SKEW_MS = 60 * 1000;

type AppLock = <T>(
  oauthAppKey: string,
  operation: (signal: AbortSignal) => Promise<T>
) => Promise<T>;

export type TrustedFigmaAuthorizationContext = {
  oauthAppKey: string;
  projectId: string;
  userId: string;
  nonceHash: string;
  authorizationCode: string;
};

export type FigmaAuthorizationResult = {
  credential: FigmaCanonicalCredentialMetadata;
  bound: boolean;
};

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function defaultAppLock<T>(
  oauthAppKey: string,
  operation: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const adapterConnectionString = connectionStringForPgAdapter(
    env.DATABASE_URL
  );
  return withPostgresSessionAdvisoryLock(
    getPostgresPool(env.DATABASE_URL),
    JSON.stringify(['figma-oauth-app', oauthAppKey]),
    operation,
    {
      connectionMode: postgresAdvisoryLockConnectionMode(
        adapterConnectionString
      ),
      acquisitionTimeoutMs: 5_000,
    }
  );
}

function isAmbiguousTokenError(error: unknown): boolean {
  return (
    error instanceof FigmaTokenOutcomeUnknownError ||
    error instanceof FigmaTokenInvalidResponseError
  );
}

export class FigmaTokenCoordinator {
  constructor(
    private readonly repository: FigmaRepository,
    private readonly tokenClient: FigmaTokenClient,
    private readonly withAppLock: AppLock = defaultAppLock
  ) {}

  exchangeAuthorizationCode(
    context: TrustedFigmaAuthorizationContext,
    confirmProjectAuthorization: () => Promise<boolean>
  ): Promise<FigmaAuthorizationResult> {
    return this.withAppLock(context.oauthAppKey, async (signal) => {
      await this.repository.recoverOverdueRequestingOperations(
        context.oauthAppKey
      );
      const authorizationCodeHash = sha256(context.authorizationCode);
      const recoverable =
        await this.repository.findRecoverableAuthorizationOperation({
          oauthAppKey: context.oauthAppKey,
          projectId: context.projectId,
          userId: context.userId,
          nonceHash: context.nonceHash,
          authorizationCodeHash,
        });
      if (recoverable) {
        await this.repository.assertNoConflictingTokenOperation(
          context.oauthAppKey,
          recoverable.id
        );
        return this.finalizeRecoveredAuthorization(
          recoverable,
          context.oauthAppKey,
          confirmProjectAuthorization
        );
      }
      await this.repository.assertNoConflictingTokenOperation(
        context.oauthAppKey
      );
      const prepared = await this.repository.prepareAuthorizationCodeOperation({
        oauthAppKey: context.oauthAppKey,
        projectId: context.projectId,
        userId: context.userId,
        nonceHash: context.nonceHash,
        authorizationCodeHash,
        retentionExpiresAt: new Date(Date.now() + JOURNAL_RETENTION_MS),
      });
      if (!prepared) {
        throw new FigmaOAuthOperationStaleError();
      }
      const codeVerifier = decryptSecret(prepared.codeVerifierEnc);

      const workerToken = randomUUID();
      await this.repository.markOperationRequesting({
        operationId: prepared.operation.id,
        workerToken,
        requestDeadlineAt: new Date(Date.now() + REQUEST_DEADLINE_MS),
      });

      let response;
      try {
        response = await this.tokenClient.exchangeAuthorizationCode(
          context.authorizationCode,
          codeVerifier,
          signal
        );
      } catch (error) {
        await this.recordFailure(prepared.operation.id, workerToken, error);
        throw error;
      }

      const accessTokenExpiresAt = new Date(
        Date.now() + response.expires_in * 1000
      );
      const encryptedEnvelope = encryptAuthorizationEnvelope(response);
      await this.repository.recordOperationResponse({
        operationId: prepared.operation.id,
        workerToken,
        encryptedEnvelope,
        envelopeKeyVersion: FIGMA_RECOVERY_ENVELOPE_KEY_VERSION,
        accessTokenExpiresAt,
        pendingScopes: 'file_metadata:read',
        envelopeExpiresAt: new Date(Date.now() + ENVELOPE_RETENTION_MS),
        providerHttpStatus: 200,
        figmaUserId: response.user_id_string,
      });

      const envelope = decryptRecoveryEnvelope(
        encryptedEnvelope,
        'authorization_code_exchange'
      );
      let allowProjectBinding = false;
      try {
        allowProjectBinding = await confirmProjectAuthorization();
      } catch {
        allowProjectBinding = false;
      }
      return this.repository.finalizeAuthorizationOperation({
        operationId: prepared.operation.id,
        oauthAppKey: context.oauthAppKey,
        figmaUserId: response.user_id_string,
        accessTokenEnc: encryptSecret(envelope.accessToken),
        refreshTokenEnc: encryptSecret(envelope.refreshToken!),
        accessTokenExpiresAt,
        scopes: 'file_metadata:read',
        allowProjectBinding,
        expectedEnvelopeEnc: encryptedEnvelope,
      });
    });
  }

  refreshCredential(input: {
    oauthAppKey: string;
    credentialId: string;
    expectedTokenVersion: number;
    force: boolean;
  }): Promise<FigmaCanonicalCredentialFull> {
    return this.withAppLock(input.oauthAppKey, async (signal) => {
      await this.repository.recoverOverdueRequestingOperations(
        input.oauthAppKey
      );
      const current = await this.repository.findCanonicalCredentialById(
        input.credentialId,
        input.oauthAppKey
      );
      if (!current) throw new FigmaOAuthOperationStaleError();
      const recoverable = await this.repository.findRecoverableRefreshOperation(
        {
          oauthAppKey: input.oauthAppKey,
          credentialId: input.credentialId,
        }
      );
      if (recoverable) {
        await this.repository.assertNoConflictingTokenOperation(
          input.oauthAppKey,
          recoverable.id
        );
        if (
          !recoverable.pending_token_response_enc ||
          !recoverable.pending_access_token_expires_at ||
          !recoverable.pending_scopes
        ) {
          throw new FigmaOAuthOperationStaleError();
        }
        const envelope = decryptRecoveryEnvelope(
          recoverable.pending_token_response_enc,
          'token_refresh'
        );
        return this.repository.finalizeRefreshOperation({
          operationId: recoverable.id,
          oauthAppKey: input.oauthAppKey,
          accessTokenEnc: encryptSecret(envelope.accessToken),
          refreshTokenEnc: encryptSecret(
            envelope.refreshToken ?? decryptSecret(current.refresh_token_enc)
          ),
          accessTokenExpiresAt: recoverable.pending_access_token_expires_at,
          scopes: recoverable.pending_scopes,
          expectedEnvelopeEnc: recoverable.pending_token_response_enc,
        });
      }
      await this.repository.assertNoConflictingTokenOperation(
        input.oauthAppKey
      );
      if (
        current.token_version !== input.expectedTokenVersion ||
        (!input.force &&
          current.access_token_expires_at.getTime() >
            Date.now() + TOKEN_EXPIRY_SKEW_MS)
      ) {
        return current;
      }

      const refreshToken = decryptSecret(current.refresh_token_enc);
      const operation = await this.repository.prepareRefreshOperation({
        oauthAppKey: input.oauthAppKey,
        credentialId: current.id,
        figmaUserId: current.figma_user_id,
        expectedTokenVersion: current.token_version,
        sourceRefreshTokenHash: sha256(refreshToken),
        retentionExpiresAt: new Date(Date.now() + JOURNAL_RETENTION_MS),
      });
      const workerToken = randomUUID();
      await this.repository.markOperationRequesting({
        operationId: operation.id,
        workerToken,
        requestDeadlineAt: new Date(Date.now() + REQUEST_DEADLINE_MS),
      });

      let response;
      try {
        response = await this.tokenClient.refresh(refreshToken, signal);
      } catch (error) {
        await this.recordFailure(operation.id, workerToken, error);
        throw error;
      }

      const accessTokenExpiresAt = new Date(
        Date.now() + response.expires_in * 1000
      );
      const encryptedEnvelope = encryptRefreshEnvelope(response);
      await this.repository.recordOperationResponse({
        operationId: operation.id,
        workerToken,
        encryptedEnvelope,
        envelopeKeyVersion: FIGMA_RECOVERY_ENVELOPE_KEY_VERSION,
        accessTokenExpiresAt,
        pendingScopes: current.scopes,
        envelopeExpiresAt: new Date(Date.now() + ENVELOPE_RETENTION_MS),
        providerHttpStatus: 200,
      });
      const envelope = decryptRecoveryEnvelope(
        encryptedEnvelope,
        'token_refresh'
      );
      return this.repository.finalizeRefreshOperation({
        operationId: operation.id,
        oauthAppKey: input.oauthAppKey,
        accessTokenEnc: encryptSecret(envelope.accessToken),
        refreshTokenEnc: encryptSecret(envelope.refreshToken ?? refreshToken),
        accessTokenExpiresAt,
        scopes: current.scopes,
        expectedEnvelopeEnc: encryptedEnvelope,
      });
    });
  }

  resolveAmbiguousOperation(input: {
    operationId: string;
    oauthAppKey: string;
    resolution: FigmaOAuthOperationResolution;
    resolvedBy: string;
  }): Promise<void> {
    return this.withAppLock(input.oauthAppKey, () =>
      this.repository.resolveAmbiguousOperation(input)
    );
  }

  private async recordFailure(
    operationId: string,
    workerToken: string,
    error: unknown
  ): Promise<void> {
    if (error instanceof FigmaTokenProviderRejectedError) {
      await this.repository.recordOperationProviderRejected({
        operationId,
        workerToken,
        providerHttpStatus: error.httpStatus,
        failureCode: error.failureCode,
        markCredentialReauthorizationRequired:
          error.failureCode === 'invalid_grant',
      });
      return;
    }
    if (isAmbiguousTokenError(error)) {
      await this.repository.recordOperationOutcomeUnknown({
        operationId,
        workerToken,
        failureCode:
          error instanceof FigmaTokenInvalidResponseError
            ? 'invalid_provider_response'
            : 'transport_outcome_unknown',
      });
      return;
    }
    await this.repository.recordOperationOutcomeUnknown({
      operationId,
      workerToken,
      failureCode: 'coordinator_interrupted',
    });
  }

  private async finalizeRecoveredAuthorization(
    operation: PreparedFigmaOAuthOperation,
    oauthAppKey: string,
    confirmProjectAuthorization: () => Promise<boolean>
  ): Promise<FigmaAuthorizationResult> {
    if (
      !operation.pending_token_response_enc ||
      !operation.pending_access_token_expires_at ||
      !operation.pending_scopes ||
      !operation.figma_user_id
    ) {
      throw new FigmaOAuthOperationStaleError();
    }
    const envelope = decryptRecoveryEnvelope(
      operation.pending_token_response_enc,
      'authorization_code_exchange'
    );
    if (
      !envelope.refreshToken ||
      envelope.figmaUserId !== operation.figma_user_id
    ) {
      throw new FigmaOAuthOperationStaleError();
    }
    let allowProjectBinding = false;
    try {
      allowProjectBinding = await confirmProjectAuthorization();
    } catch {
      allowProjectBinding = false;
    }
    return this.repository.finalizeAuthorizationOperation({
      operationId: operation.id,
      oauthAppKey,
      figmaUserId: operation.figma_user_id,
      accessTokenEnc: encryptSecret(envelope.accessToken),
      refreshTokenEnc: encryptSecret(envelope.refreshToken),
      accessTokenExpiresAt: operation.pending_access_token_expires_at,
      scopes: operation.pending_scopes,
      allowProjectBinding,
      expectedEnvelopeEnc: operation.pending_token_response_enc,
    });
  }
}

export { FigmaOAuthOperationBlockedError } from './figma.repository';
