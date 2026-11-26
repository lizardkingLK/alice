import {
  FigmaOAuthCredentialStatus,
  FigmaOAuthOperationKind,
  FigmaOAuthOperationResolution,
  FigmaOAuthOperationStatus,
  FigmaOAuthProjectBindingStatus,
  Prisma,
} from '@repo/types/prisma';
import { prisma } from '../../../lib/prisma';

const CREDENTIAL_METADATA_SELECT = {
  id: true,
  oauth_app_key: true,
  figma_user_id: true,
  access_token_expires_at: true,
  scopes: true,
  status: true,
  token_version: true,
  last_validated_at: true,
  last_authorized_by: true,
  created_at: true,
  updated_at: true,
} as const;

const CREDENTIAL_FULL_SELECT = {
  ...CREDENTIAL_METADATA_SELECT,
  access_token_enc: true,
  refresh_token_enc: true,
} as const;

const CONNECTION_PUBLIC_SELECT = {
  id: true,
  project_id: true,
  authorized_by: true,
  figma_user_id: true,
  scopes: true,
  access_token_expires_at: true,
  verified_file_key: true,
  verified_file_name: true,
  verified_at: true,
  verification_error: true,
  created_at: true,
  updated_at: true,
  authorized_by_user: { select: { id: true, name: true } },
} as const;

const CONNECTION_FULL_SELECT = {
  ...CONNECTION_PUBLIC_SELECT,
  access_token_enc: true,
  refresh_token_enc: true,
} as const;

const CONNECTION_WITH_CREDENTIAL_SELECT = {
  ...CONNECTION_FULL_SELECT,
  credential_id: true,
  credential: { select: CREDENTIAL_FULL_SELECT },
} as const;

const OPERATION_SELECT = {
  id: true,
  journal_sequence: true,
  kind: true,
  status: true,
  oauth_app_key: true,
  oauth_attempt_id: true,
  project_id: true,
  project_binding_generation: true,
  initiated_by: true,
  credential_id: true,
  figma_user_id: true,
  expected_token_version: true,
  pending_token_response_enc: true,
  pending_token_key_version: true,
  pending_access_token_expires_at: true,
  pending_scopes: true,
  pending_token_expires_at: true,
  project_binding_status: true,
} as const;

export type FigmaConnectionPublic = {
  id: string;
  project_id: string;
  authorized_by: string;
  figma_user_id: string;
  scopes: string;
  access_token_expires_at: Date;
  verified_file_key: string | null;
  verified_file_name: string | null;
  verified_at: Date | null;
  verification_error: string | null;
  created_at: Date;
  updated_at: Date;
  authorized_by_user: { id: string; name: string };
};

export type FigmaConnectionFull = FigmaConnectionPublic & {
  access_token_enc: string;
  refresh_token_enc: string;
};

export type FigmaCanonicalCredentialMetadata = {
  id: string;
  oauth_app_key: string;
  figma_user_id: string;
  access_token_expires_at: Date;
  scopes: string;
  status: FigmaOAuthCredentialStatus;
  token_version: number;
  last_validated_at: Date | null;
  last_authorized_by: string | null;
  created_at: Date;
  updated_at: Date;
};

export type FigmaCanonicalCredentialFull = FigmaCanonicalCredentialMetadata & {
  access_token_enc: string;
  refresh_token_enc: string;
};

export type FigmaEffectiveConnection = FigmaConnectionFull & {
  credential_id: string | null;
  credential_source: 'canonical' | 'legacy';
  oauth_app_verified: boolean;
  oauth_app_key: string | null;
  credential_status: FigmaOAuthCredentialStatus | null;
  token_version: number | null;
  last_validated_at: Date | null;
};

export type ConsumedFigmaOAuthAttempt = {
  id: string;
  project_id: string;
  user_id: string;
  code_verifier_enc: string;
};

export type PreparedFigmaOAuthOperation = {
  id: string;
  journal_sequence: bigint;
  kind: FigmaOAuthOperationKind;
  status: FigmaOAuthOperationStatus;
  oauth_app_key: string;
  oauth_attempt_id: string | null;
  project_id: string | null;
  project_binding_generation: number | null;
  initiated_by: string | null;
  credential_id: string | null;
  figma_user_id: string | null;
  expected_token_version: number | null;
  pending_token_response_enc: string | null;
  pending_token_key_version: number | null;
  pending_access_token_expires_at: Date | null;
  pending_scopes: string | null;
  pending_token_expires_at: Date | null;
  project_binding_status: FigmaOAuthProjectBindingStatus;
};

export type PreparedFigmaAuthorizationOperation = {
  operation: PreparedFigmaOAuthOperation;
  codeVerifierEnc: string;
};

export type FigmaVerificationFields = {
  verifiedFileKey: string | null;
  verifiedFileName: string | null;
  verifiedAt: Date | null;
  verificationError: string | null;
};

export type UpsertFigmaCredentialAndBindingInput = {
  oauthAppKey: string;
  projectId: string;
  authorizedBy: string;
  figmaUserId: string;
  accessTokenEnc: string;
  refreshTokenEnc: string;
  accessTokenExpiresAt: Date;
  scopes: string;
  status: FigmaOAuthCredentialStatus;
  expectedTokenVersion: number | null;
  lastValidatedAt: Date | null;
  verification: FigmaVerificationFields;
};

export type UpsertFigmaProjectBindingInput = {
  credentialId: string;
  expectedOAuthAppKey: string;
  projectId: string;
  authorizedBy: string;
  verification?: FigmaVerificationFields;
};

type ConnectionWithCredential = FigmaConnectionFull & {
  credential_id: string | null;
  credential: FigmaCanonicalCredentialFull | null;
};

export class FigmaCredentialVersionConflictError extends Error {
  constructor() {
    super('Figma credential changed before this operation completed.');
    this.name = 'FigmaCredentialVersionConflictError';
  }
}

export class FigmaCredentialReplacementDeferredError extends Error {
  constructor() {
    super(
      'Replacing an existing Figma credential requires the protected OAuth token flow.'
    );
    this.name = 'FigmaCredentialReplacementDeferredError';
  }
}

export class FigmaOAuthAppMismatchError extends Error {
  constructor() {
    super('The Figma credential belongs to a different OAuth application.');
    this.name = 'FigmaOAuthAppMismatchError';
  }
}

export class FigmaOAuthOperationBlockedError extends Error {
  constructor() {
    super(
      'A previous Figma token operation needs explicit resolution before another token request is safe.'
    );
    this.name = 'FigmaOAuthOperationBlockedError';
  }
}

export class FigmaOAuthOperationStaleError extends Error {
  constructor() {
    super('The Figma token operation is stale or is owned by another worker.');
    this.name = 'FigmaOAuthOperationStaleError';
  }
}

function credentialIdentityLockKey(
  oauthAppKey: string,
  figmaUserId: string
): string {
  return JSON.stringify([
    'figma-oauth-credential-identity',
    oauthAppKey,
    figmaUserId,
  ]);
}

function credentialIdLockKey(credentialId: string): string {
  return JSON.stringify(['figma-oauth-credential-id', credentialId]);
}

function projectBindingLockKey(projectId: string): string {
  return JSON.stringify(['figma-oauth-project-binding', projectId]);
}

async function acquireAdvisoryLock(
  tx: Prisma.TransactionClient,
  lockKey: string
): Promise<void> {
  // pg_advisory_xact_lock() returns void; $queryRaw cannot deserialize void
  // columns (GI-666). Use $executeRaw, which discards the result set and only
  // returns the affected-row count (always 0 for advisory locks).
  await tx.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`
  );
}

function verificationData(verification: FigmaVerificationFields) {
  return {
    verified_file_key: verification.verifiedFileKey,
    verified_file_name: verification.verifiedFileName,
    verified_at: verification.verifiedAt,
    verification_error: verification.verificationError,
  };
}

function toEffectiveConnection(
  row: ConnectionWithCredential
): FigmaEffectiveConnection {
  const { credential, credential_id: credentialId, ...connection } = row;
  if (!credential) {
    return {
      ...connection,
      credential_id: null,
      credential_source: 'legacy',
      oauth_app_verified: false,
      oauth_app_key: null,
      credential_status: null,
      token_version: null,
      last_validated_at: null,
    };
  }

  return {
    ...connection,
    credential_id: credentialId,
    credential_source: 'canonical',
    oauth_app_verified: true,
    oauth_app_key: credential.oauth_app_key,
    credential_status: credential.status,
    token_version: credential.token_version,
    last_validated_at: credential.last_validated_at,
    figma_user_id: credential.figma_user_id,
    access_token_enc: credential.access_token_enc,
    refresh_token_enc: credential.refresh_token_enc,
    access_token_expires_at: credential.access_token_expires_at,
    scopes: credential.scopes,
  };
}

export class FigmaRepository {
  getProject(projectId: string): Promise<{
    id: string;
    figma_url: string | null;
  } | null> {
    return prisma.projects.findUnique({
      where: { id: projectId },
      select: { id: true, figma_url: true },
    });
  }

  async createOAuthAttempt(input: {
    projectId: string;
    userId: string;
    nonceHash: string;
    codeVerifierEnc: string;
    expiresAt: Date;
  }): Promise<void> {
    await prisma.$transaction([
      prisma.figma_oauth_attempts.deleteMany({
        where: {
          OR: [
            { expires_at: { lte: new Date() } },
            { consumed_at: { not: null } },
          ],
        },
      }),
      prisma.figma_oauth_attempts.create({
        data: {
          project_id: input.projectId,
          user_id: input.userId,
          nonce_hash: input.nonceHash,
          code_verifier_enc: input.codeVerifierEnc,
          expires_at: input.expiresAt,
        },
      }),
    ]);
  }

  async createCoordinatedOAuthAttempt(input: {
    oauthAppKey: string;
    projectId: string;
    userId: string;
    nonceHash: string;
    codeVerifierEnc: string;
    expiresAt: Date;
  }): Promise<number> {
    return prisma.$transaction(async (tx) => {
      await acquireAdvisoryLock(tx, projectBindingLockKey(input.projectId));
      const project = await tx.projects.update({
        where: { id: input.projectId },
        data: { figma_binding_generation: { increment: 1 } },
        select: { figma_binding_generation: true },
      });
      await tx.figma_oauth_attempts.deleteMany({
        where: {
          OR: [
            { expires_at: { lte: new Date() } },
            { consumed_at: { not: null } },
          ],
        },
      });
      await tx.figma_oauth_attempts.create({
        data: {
          project_id: input.projectId,
          user_id: input.userId,
          oauth_app_key: input.oauthAppKey,
          project_binding_generation: project.figma_binding_generation,
          nonce_hash: input.nonceHash,
          code_verifier_enc: input.codeVerifierEnc,
          expires_at: input.expiresAt,
        },
      });
      return project.figma_binding_generation;
    });
  }

  async consumeOAuthAttempt(input: {
    projectId: string;
    userId: string;
    nonceHash: string;
  }): Promise<ConsumedFigmaOAuthAttempt | null> {
    return prisma.$transaction(async (tx) => {
      const attempt = await tx.figma_oauth_attempts.findFirst({
        where: {
          project_id: input.projectId,
          user_id: input.userId,
          nonce_hash: input.nonceHash,
          consumed_at: null,
          expires_at: { gt: new Date() },
        },
        select: {
          id: true,
          project_id: true,
          user_id: true,
          code_verifier_enc: true,
        },
      });
      if (!attempt) {
        return null;
      }
      if (!attempt.code_verifier_enc) {
        return null;
      }
      const codeVerifierEnc = attempt.code_verifier_enc;

      const consumed = await tx.figma_oauth_attempts.updateMany({
        where: { id: attempt.id, consumed_at: null },
        data: { consumed_at: new Date() },
      });
      return consumed.count === 1
        ? {
            id: attempt.id,
            project_id: attempt.project_id,
            user_id: attempt.user_id,
            code_verifier_enc: codeVerifierEnc,
          }
        : null;
    });
  }

  findConnectionByProjectId(
    projectId: string
  ): Promise<FigmaConnectionPublic | null> {
    return prisma.figma_connections.findUnique({
      where: { project_id: projectId },
      select: CONNECTION_PUBLIC_SELECT,
    });
  }

  /** Server-only lookup for one exact Figma OAuth app/account identity. */
  findCanonicalCredentialByIdentity(
    oauthAppKey: string,
    figmaUserId: string
  ): Promise<FigmaCanonicalCredentialFull | null> {
    return prisma.figma_oauth_credentials.findUnique({
      where: {
        oauth_app_key_figma_user_id: {
          oauth_app_key: oauthAppKey,
          figma_user_id: figmaUserId,
        },
      },
      select: CREDENTIAL_FULL_SELECT,
    });
  }

  /**
   * Resolves credentials only through a project binding. Canonical credentials
   * win when present; unbackfilled connections continue to use legacy columns.
   */
  async findCredentialByProjectBinding(
    projectId: string,
    expectedOAuthAppKey: string
  ): Promise<FigmaEffectiveConnection | null> {
    const row = await prisma.figma_connections.findUnique({
      where: { project_id: projectId },
      select: CONNECTION_WITH_CREDENTIAL_SELECT,
    });
    if (!row) {
      return null;
    }
    const typedRow = row as ConnectionWithCredential;
    if (
      typedRow.credential &&
      typedRow.credential.oauth_app_key !== expectedOAuthAppKey
    ) {
      throw new FigmaOAuthAppMismatchError();
    }
    return toEffectiveConnection(typedRow);
  }

  findFullConnectionByProjectId(
    projectId: string
  ): Promise<FigmaConnectionFull | null> {
    return prisma.figma_connections.findUnique({
      where: { project_id: projectId },
      select: CONNECTION_FULL_SELECT,
    });
  }

  upsertConnection(input: {
    projectId: string;
    authorizedBy: string;
    figmaUserId: string;
    accessTokenEnc: string;
    refreshTokenEnc: string;
    accessTokenExpiresAt: Date;
    scopes: string;
    verification: FigmaVerificationFields;
  }): Promise<FigmaConnectionPublic> {
    const data = {
      authorized_by: input.authorizedBy,
      figma_user_id: input.figmaUserId,
      access_token_enc: input.accessTokenEnc,
      refresh_token_enc: input.refreshTokenEnc,
      access_token_expires_at: input.accessTokenExpiresAt,
      scopes: input.scopes,
      verified_file_key: input.verification.verifiedFileKey,
      verified_file_name: input.verification.verifiedFileName,
      verified_at: input.verification.verifiedAt,
      verification_error: input.verification.verificationError,
    };

    return prisma.figma_connections.upsert({
      where: { project_id: input.projectId },
      create: { project_id: input.projectId, ...data },
      update: data,
      select: CONNECTION_PUBLIC_SELECT,
    });
  }

  /**
   * Creates the first canonical credential and project binding atomically.
   * Existing-token replacement is deliberately deferred: database commit order
   * cannot prove which concurrently issued Figma token is still valid.
   */
  upsertCredentialAndProjectBinding(
    input: UpsertFigmaCredentialAndBindingInput
  ): Promise<{
    credential: FigmaCanonicalCredentialMetadata;
    connection: FigmaConnectionPublic;
  }> {
    return prisma.$transaction(async (tx) => {
      await acquireAdvisoryLock(
        tx,
        credentialIdentityLockKey(input.oauthAppKey, input.figmaUserId)
      );
      const existingIdentity = await tx.figma_oauth_credentials.findUnique({
        where: {
          oauth_app_key_figma_user_id: {
            oauth_app_key: input.oauthAppKey,
            figma_user_id: input.figmaUserId,
          },
        },
        select: { id: true },
      });

      if (existingIdentity) {
        await acquireAdvisoryLock(tx, credentialIdLockKey(existingIdentity.id));
        const current = await tx.figma_oauth_credentials.findUnique({
          where: { id: existingIdentity.id },
          select: CREDENTIAL_METADATA_SELECT,
        });
        if (!current || input.expectedTokenVersion !== current.token_version) {
          throw new FigmaCredentialVersionConflictError();
        }
        throw new FigmaCredentialReplacementDeferredError();
      }

      if (input.expectedTokenVersion !== null) {
        throw new FigmaCredentialVersionConflictError();
      }

      const credential = await tx.figma_oauth_credentials.create({
        data: {
          oauth_app_key: input.oauthAppKey,
          figma_user_id: input.figmaUserId,
          access_token_enc: input.accessTokenEnc,
          refresh_token_enc: input.refreshTokenEnc,
          access_token_expires_at: input.accessTokenExpiresAt,
          scopes: input.scopes,
          status: input.status,
          last_validated_at: input.lastValidatedAt,
          last_authorized_by: input.authorizedBy,
        },
        select: CREDENTIAL_METADATA_SELECT,
      });

      const legacyCredentialData = {
        figma_user_id: input.figmaUserId,
        access_token_enc: input.accessTokenEnc,
        refresh_token_enc: input.refreshTokenEnc,
        access_token_expires_at: input.accessTokenExpiresAt,
        scopes: input.scopes,
      };

      const projectData = {
        credential_id: credential.id,
        authorized_by: input.authorizedBy,
        ...legacyCredentialData,
        ...verificationData(input.verification),
      };
      await acquireAdvisoryLock(tx, projectBindingLockKey(input.projectId));
      const connection = await tx.figma_connections.upsert({
        where: { project_id: input.projectId },
        create: { project_id: input.projectId, ...projectData },
        update: projectData,
        select: CONNECTION_PUBLIC_SELECT,
      });

      return { credential, connection };
    });
  }

  /**
   * Binds a project to an existing credential without changing that credential.
   * The caller must have both project access and trusted, server-side OAuth
   * authorization for this exact credential. Phase 3 does not expose this
   * method through the service until that callback context exists.
   */
  upsertProjectCredentialBinding(
    input: UpsertFigmaProjectBindingInput
  ): Promise<FigmaConnectionPublic> {
    return prisma.$transaction(async (tx) => {
      await acquireAdvisoryLock(tx, credentialIdLockKey(input.credentialId));
      const credential = await tx.figma_oauth_credentials.findUnique({
        where: { id: input.credentialId },
        select: CREDENTIAL_FULL_SELECT,
      });
      if (!credential) {
        throw new Error('Figma credential not found.');
      }
      if (credential.oauth_app_key !== input.expectedOAuthAppKey) {
        throw new FigmaOAuthAppMismatchError();
      }
      await acquireAdvisoryLock(tx, projectBindingLockKey(input.projectId));
      const existingBinding = await tx.figma_connections.findUnique({
        where: { project_id: input.projectId },
        select: { credential_id: true },
      });

      const legacyCredentialData = {
        figma_user_id: credential.figma_user_id,
        access_token_enc: credential.access_token_enc,
        refresh_token_enc: credential.refresh_token_enc,
        access_token_expires_at: credential.access_token_expires_at,
        scopes: credential.scopes,
      };
      const credentialChanged = Boolean(
        existingBinding && existingBinding.credential_id !== credential.id
      );
      const clearedVerification = verificationData({
        verifiedFileKey: null,
        verifiedFileName: null,
        verifiedAt: null,
        verificationError: null,
      });
      let verification: ReturnType<typeof verificationData> | undefined;
      if (input.verification) {
        verification = verificationData(input.verification);
      } else if (credentialChanged) {
        verification = clearedVerification;
      }
      const createData = {
        project_id: input.projectId,
        credential_id: credential.id,
        authorized_by: input.authorizedBy,
        ...legacyCredentialData,
        ...(verification ?? clearedVerification),
      };
      const updateData = {
        credential_id: credential.id,
        authorized_by: input.authorizedBy,
        ...legacyCredentialData,
        ...(verification ?? {}),
      };

      return tx.figma_connections.upsert({
        where: { project_id: input.projectId },
        create: createData,
        update: updateData,
        select: CONNECTION_PUBLIC_SELECT,
      });
    });
  }

  updateTokens(
    projectId: string,
    input: { accessTokenEnc: string; accessTokenExpiresAt: Date }
  ): Promise<FigmaConnectionFull> {
    // Legacy service path only. Canonical refreshes require the future locked
    // refresh method and must not be routed through this project-row update.
    return prisma.figma_connections.update({
      where: { project_id: projectId },
      data: {
        access_token_enc: input.accessTokenEnc,
        access_token_expires_at: input.accessTokenExpiresAt,
      },
      select: CONNECTION_FULL_SELECT,
    });
  }

  updateVerification(
    projectId: string,
    verification: FigmaVerificationFields
  ): Promise<FigmaConnectionPublic> {
    return prisma.figma_connections.update({
      where: { project_id: projectId },
      data: {
        verified_file_key: verification.verifiedFileKey,
        verified_file_name: verification.verifiedFileName,
        verified_at: verification.verifiedAt,
        verification_error: verification.verificationError,
      },
      select: CONNECTION_PUBLIC_SELECT,
    });
  }

  async deleteConnection(projectId: string): Promise<boolean> {
    return this.deleteProjectBinding(projectId);
  }

  async deleteProjectBinding(projectId: string): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      await acquireAdvisoryLock(tx, projectBindingLockKey(projectId));
      await tx.projects.update({
        where: { id: projectId },
        data: { figma_binding_generation: { increment: 1 } },
      });
      const result = await tx.figma_connections.deleteMany({
        where: { project_id: projectId },
      });
      return result.count === 1;
    });
  }

  findCanonicalCredentialById(
    credentialId: string,
    oauthAppKey: string
  ): Promise<FigmaCanonicalCredentialFull | null> {
    return prisma.figma_oauth_credentials.findFirst({
      where: { id: credentialId, oauth_app_key: oauthAppKey },
      select: CREDENTIAL_FULL_SELECT,
    });
  }

  findRecoverableAuthorizationOperation(input: {
    oauthAppKey: string;
    projectId: string;
    userId: string;
    nonceHash: string;
    authorizationCodeHash: string;
  }): Promise<PreparedFigmaOAuthOperation | null> {
    return prisma.figma_oauth_operations.findFirst({
      where: {
        oauth_app_key: input.oauthAppKey,
        project_id: input.projectId,
        initiated_by: input.userId,
        oauth_attempt_nonce_hash: input.nonceHash,
        authorization_code_hash: input.authorizationCodeHash,
        status: FigmaOAuthOperationStatus.response_received,
      },
      select: OPERATION_SELECT,
    });
  }

  findRecoverableRefreshOperation(input: {
    oauthAppKey: string;
    credentialId: string;
  }): Promise<PreparedFigmaOAuthOperation | null> {
    return prisma.figma_oauth_operations.findFirst({
      where: {
        oauth_app_key: input.oauthAppKey,
        credential_id: input.credentialId,
        kind: FigmaOAuthOperationKind.token_refresh,
        status: FigmaOAuthOperationStatus.response_received,
      },
      orderBy: { journal_sequence: 'desc' },
      select: OPERATION_SELECT,
    });
  }

  async prepareAuthorizationCodeOperation(input: {
    oauthAppKey: string;
    projectId: string;
    userId: string;
    nonceHash: string;
    authorizationCodeHash: string;
    retentionExpiresAt: Date;
  }): Promise<PreparedFigmaAuthorizationOperation | null> {
    return prisma.$transaction(async (tx) => {
      const attempt = await tx.figma_oauth_attempts.findFirst({
        where: {
          project_id: input.projectId,
          user_id: input.userId,
          oauth_app_key: input.oauthAppKey,
          nonce_hash: input.nonceHash,
          consumed_at: null,
          expires_at: { gt: new Date() },
        },
        select: {
          id: true,
          code_verifier_enc: true,
          project_binding_generation: true,
        },
      });
      if (
        !attempt?.code_verifier_enc ||
        attempt.project_binding_generation === null
      ) {
        return null;
      }
      const project = await tx.projects.findUnique({
        where: { id: input.projectId },
        select: { figma_binding_generation: true },
      });
      if (
        !project ||
        project.figma_binding_generation !== attempt.project_binding_generation
      ) {
        return null;
      }
      const consumed = await tx.figma_oauth_attempts.updateMany({
        where: { id: attempt.id, consumed_at: null },
        data: { consumed_at: new Date(), code_verifier_enc: null },
      });
      if (consumed.count !== 1) return null;

      const operation = await tx.figma_oauth_operations.create({
        data: {
          kind: FigmaOAuthOperationKind.authorization_code_exchange,
          oauth_app_key: input.oauthAppKey,
          oauth_attempt_id: attempt.id,
          oauth_attempt_nonce_hash: input.nonceHash,
          authorization_code_hash: input.authorizationCodeHash,
          project_id: input.projectId,
          project_binding_generation: attempt.project_binding_generation,
          initiated_by: input.userId,
          project_binding_status: FigmaOAuthProjectBindingStatus.pending,
          retention_expires_at: input.retentionExpiresAt,
        },
        select: OPERATION_SELECT,
      });
      return { operation, codeVerifierEnc: attempt.code_verifier_enc };
    });
  }

  async prepareRefreshOperation(input: {
    oauthAppKey: string;
    credentialId: string;
    figmaUserId: string;
    expectedTokenVersion: number;
    sourceRefreshTokenHash: string;
    retentionExpiresAt: Date;
  }): Promise<PreparedFigmaOAuthOperation> {
    return prisma.figma_oauth_operations.create({
      data: {
        kind: FigmaOAuthOperationKind.token_refresh,
        oauth_app_key: input.oauthAppKey,
        source_refresh_token_hash: input.sourceRefreshTokenHash,
        credential_id: input.credentialId,
        figma_user_id: input.figmaUserId,
        expected_token_version: input.expectedTokenVersion,
        project_binding_status: FigmaOAuthProjectBindingStatus.not_applicable,
        retention_expires_at: input.retentionExpiresAt,
      },
      select: OPERATION_SELECT,
    });
  }

  async assertNoConflictingTokenOperation(
    oauthAppKey: string,
    excludeOperationId?: string
  ): Promise<void> {
    const conflict = await prisma.figma_oauth_operations.findFirst({
      where: {
        oauth_app_key: oauthAppKey,
        id: excludeOperationId ? { not: excludeOperationId } : undefined,
        status: {
          in: [
            FigmaOAuthOperationStatus.requesting,
            FigmaOAuthOperationStatus.response_received,
            FigmaOAuthOperationStatus.outcome_unknown,
          ],
        },
      },
      select: { id: true },
    });
    if (conflict) throw new FigmaOAuthOperationBlockedError();
  }

  async recoverOverdueRequestingOperations(oauthAppKey: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const now = new Date();
      const overdue = await tx.figma_oauth_operations.findMany({
        where: {
          oauth_app_key: oauthAppKey,
          status: FigmaOAuthOperationStatus.requesting,
          request_deadline_at: { lte: now },
        },
        select: { credential_id: true },
      });
      if (overdue.length === 0) return;
      await tx.figma_oauth_operations.updateMany({
        where: {
          oauth_app_key: oauthAppKey,
          status: FigmaOAuthOperationStatus.requesting,
          request_deadline_at: { lte: now },
        },
        data: {
          status: FigmaOAuthOperationStatus.outcome_unknown,
          worker_token: null,
          failure_code: 'worker_deadline_exceeded',
          outcome_unknown_at: now,
        },
      });
      const credentialIds = [
        ...new Set(
          overdue
            .map((operation) => operation.credential_id)
            .filter((id): id is string => Boolean(id))
        ),
      ];
      if (credentialIds.length > 0) {
        await tx.figma_oauth_credentials.updateMany({
          where: { id: { in: credentialIds } },
          data: { status: FigmaOAuthCredentialStatus.unknown },
        });
      }
    });
  }

  async markOperationRequesting(input: {
    operationId: string;
    workerToken: string;
    requestDeadlineAt: Date;
  }): Promise<void> {
    const result = await prisma.figma_oauth_operations.updateMany({
      where: {
        id: input.operationId,
        status: FigmaOAuthOperationStatus.prepared,
        worker_token: null,
      },
      data: {
        status: FigmaOAuthOperationStatus.requesting,
        worker_token: input.workerToken,
        request_started_at: new Date(),
        request_deadline_at: input.requestDeadlineAt,
      },
    });
    if (result.count !== 1) throw new FigmaOAuthOperationStaleError();
  }

  async recordOperationResponse(input: {
    operationId: string;
    workerToken: string;
    encryptedEnvelope: string;
    envelopeKeyVersion: number;
    accessTokenExpiresAt: Date;
    pendingScopes: string;
    envelopeExpiresAt: Date;
    providerHttpStatus: number;
    figmaUserId?: string;
  }): Promise<void> {
    const result = await prisma.figma_oauth_operations.updateMany({
      where: {
        id: input.operationId,
        status: FigmaOAuthOperationStatus.requesting,
        worker_token: input.workerToken,
      },
      data: {
        status: FigmaOAuthOperationStatus.response_received,
        worker_token: null,
        pending_token_response_enc: input.encryptedEnvelope,
        pending_token_key_version: input.envelopeKeyVersion,
        pending_access_token_expires_at: input.accessTokenExpiresAt,
        pending_scopes: input.pendingScopes,
        pending_token_expires_at: input.envelopeExpiresAt,
        response_received_at: new Date(),
        provider_http_status: input.providerHttpStatus,
        figma_user_id: input.figmaUserId,
        figma_identity_verified_at: input.figmaUserId ? new Date() : undefined,
      },
    });
    if (result.count !== 1) throw new FigmaOAuthOperationStaleError();
  }

  async recordOperationOutcomeUnknown(input: {
    operationId: string;
    workerToken: string;
    failureCode: string;
  }): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const operation = await tx.figma_oauth_operations.findFirst({
        where: {
          id: input.operationId,
          status: FigmaOAuthOperationStatus.requesting,
          worker_token: input.workerToken,
        },
        select: { credential_id: true },
      });
      if (!operation) throw new FigmaOAuthOperationStaleError();
      const result = await tx.figma_oauth_operations.updateMany({
        where: {
          id: input.operationId,
          status: FigmaOAuthOperationStatus.requesting,
          worker_token: input.workerToken,
        },
        data: {
          status: FigmaOAuthOperationStatus.outcome_unknown,
          worker_token: null,
          failure_code: input.failureCode,
          outcome_unknown_at: new Date(),
        },
      });
      if (result.count !== 1) throw new FigmaOAuthOperationStaleError();
      if (operation.credential_id) {
        await tx.figma_oauth_credentials.updateMany({
          where: { id: operation.credential_id },
          data: { status: FigmaOAuthCredentialStatus.unknown },
        });
      }
    });
  }

  async recordOperationProviderRejected(input: {
    operationId: string;
    workerToken: string;
    providerHttpStatus: number;
    failureCode: string;
    markCredentialReauthorizationRequired: boolean;
  }): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const operation = await tx.figma_oauth_operations.findFirst({
        where: {
          id: input.operationId,
          status: FigmaOAuthOperationStatus.requesting,
          worker_token: input.workerToken,
        },
        select: { credential_id: true },
      });
      if (!operation) throw new FigmaOAuthOperationStaleError();
      const result = await tx.figma_oauth_operations.updateMany({
        where: {
          id: input.operationId,
          status: FigmaOAuthOperationStatus.requesting,
          worker_token: input.workerToken,
        },
        data: {
          status: FigmaOAuthOperationStatus.provider_rejected,
          worker_token: null,
          provider_http_status: input.providerHttpStatus,
          failure_code: input.failureCode,
          completed_at: new Date(),
          project_binding_status: operation.credential_id
            ? undefined
            : FigmaOAuthProjectBindingStatus.skipped,
          project_binding_completed_at: operation.credential_id
            ? undefined
            : new Date(),
          project_binding_skip_reason: operation.credential_id
            ? undefined
            : 'provider_rejected',
        },
      });
      if (result.count !== 1) throw new FigmaOAuthOperationStaleError();
      if (
        input.markCredentialReauthorizationRequired &&
        operation.credential_id
      ) {
        await tx.figma_oauth_credentials.updateMany({
          where: { id: operation.credential_id },
          data: {
            status: FigmaOAuthCredentialStatus.reauthorization_required,
          },
        });
      }
    });
  }

  async resolveAmbiguousOperation(input: {
    operationId: string;
    oauthAppKey: string;
    resolution: FigmaOAuthOperationResolution;
    resolvedBy: string;
  }): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const operation = await tx.figma_oauth_operations.findFirst({
        where: {
          id: input.operationId,
          oauth_app_key: input.oauthAppKey,
          status: FigmaOAuthOperationStatus.outcome_unknown,
        },
        select: { credential_id: true, kind: true },
      });
      if (!operation) throw new FigmaOAuthOperationStaleError();
      if (
        input.resolution ===
        FigmaOAuthOperationResolution.oauth_app_credentials_rotated
      ) {
        await tx.figma_oauth_credentials.updateMany({
          where: { oauth_app_key: input.oauthAppKey },
          data: {
            status: FigmaOAuthCredentialStatus.reauthorization_required,
          },
        });
      } else if (operation.credential_id) {
        await acquireAdvisoryLock(
          tx,
          credentialIdLockKey(operation.credential_id)
        );
        await tx.figma_oauth_credentials.updateMany({
          where: { id: operation.credential_id },
          data: {
            status: FigmaOAuthCredentialStatus.reauthorization_required,
          },
        });
      }
      const providerRejected =
        input.resolution ===
        FigmaOAuthOperationResolution.provider_rejection_confirmed;
      const result = await tx.figma_oauth_operations.updateMany({
        where: {
          id: input.operationId,
          oauth_app_key: input.oauthAppKey,
          status: FigmaOAuthOperationStatus.outcome_unknown,
        },
        data: {
          status: providerRejected
            ? FigmaOAuthOperationStatus.provider_rejected
            : FigmaOAuthOperationStatus.superseded,
          resolution: input.resolution,
          resolved_at: new Date(),
          resolved_by: input.resolvedBy,
          completed_at: new Date(),
          project_binding_status:
            operation.kind ===
            FigmaOAuthOperationKind.authorization_code_exchange
              ? FigmaOAuthProjectBindingStatus.skipped
              : undefined,
          project_binding_completed_at:
            operation.kind ===
            FigmaOAuthOperationKind.authorization_code_exchange
              ? new Date()
              : undefined,
          project_binding_skip_reason:
            operation.kind ===
            FigmaOAuthOperationKind.authorization_code_exchange
              ? 'ambiguous_operation_resolved'
              : undefined,
        },
      });
      if (result.count !== 1) throw new FigmaOAuthOperationStaleError();
    });
  }

  async finalizeAuthorizationOperation(input: {
    operationId: string;
    oauthAppKey: string;
    figmaUserId: string;
    accessTokenEnc: string;
    refreshTokenEnc: string;
    accessTokenExpiresAt: Date;
    scopes: string;
    allowProjectBinding: boolean;
    expectedEnvelopeEnc: string;
  }): Promise<{
    credential: FigmaCanonicalCredentialMetadata;
    bound: boolean;
  }> {
    return prisma.$transaction(async (tx) => {
      const operation = await tx.figma_oauth_operations.findUnique({
        where: { id: input.operationId },
        select: OPERATION_SELECT,
      });
      if (
        !operation ||
        operation.status !== FigmaOAuthOperationStatus.response_received ||
        operation.kind !==
          FigmaOAuthOperationKind.authorization_code_exchange ||
        operation.oauth_app_key !== input.oauthAppKey ||
        operation.figma_user_id !== input.figmaUserId ||
        operation.pending_token_response_enc !== input.expectedEnvelopeEnc ||
        operation.pending_token_key_version !== 1 ||
        !operation.pending_token_expires_at ||
        operation.pending_token_expires_at <= new Date()
      ) {
        throw new FigmaOAuthOperationStaleError();
      }
      await acquireAdvisoryLock(
        tx,
        credentialIdentityLockKey(input.oauthAppKey, input.figmaUserId)
      );
      const existing = await tx.figma_oauth_credentials.findUnique({
        where: {
          oauth_app_key_figma_user_id: {
            oauth_app_key: input.oauthAppKey,
            figma_user_id: input.figmaUserId,
          },
        },
        select: {
          ...CREDENTIAL_METADATA_SELECT,
          last_token_operation_sequence: true,
        },
      });
      if (existing) {
        await acquireAdvisoryLock(tx, credentialIdLockKey(existing.id));
      }
      if (
        existing &&
        existing.last_token_operation_sequence >= operation.journal_sequence
      ) {
        await tx.figma_oauth_operations.update({
          where: { id: operation.id },
          data: {
            status: FigmaOAuthOperationStatus.superseded,
            pending_token_response_enc: null,
            pending_token_key_version: null,
            pending_access_token_expires_at: null,
            pending_scopes: null,
            pending_token_expires_at: null,
            completed_at: new Date(),
            project_binding_status: FigmaOAuthProjectBindingStatus.skipped,
            project_binding_completed_at: new Date(),
            project_binding_skip_reason: 'stale_token_operation',
          },
        });
        return { credential: existing, bound: false };
      }

      const tokenData = {
        access_token_enc: input.accessTokenEnc,
        refresh_token_enc: input.refreshTokenEnc,
        access_token_expires_at: input.accessTokenExpiresAt,
        scopes: input.scopes,
        status: FigmaOAuthCredentialStatus.active,
        last_validated_at: new Date(),
        last_authorized_by: operation.initiated_by,
        last_token_operation_sequence: operation.journal_sequence,
        last_token_operation_id: operation.id,
      };
      const credential = existing
        ? await tx.figma_oauth_credentials.update({
            where: { id: existing.id },
            data: { ...tokenData, token_version: { increment: 1 } },
            select: CREDENTIAL_METADATA_SELECT,
          })
        : await tx.figma_oauth_credentials.create({
            data: {
              oauth_app_key: input.oauthAppKey,
              figma_user_id: input.figmaUserId,
              ...tokenData,
            },
            select: CREDENTIAL_METADATA_SELECT,
          });

      const legacyTokenData = {
        figma_user_id: input.figmaUserId,
        access_token_enc: input.accessTokenEnc,
        refresh_token_enc: input.refreshTokenEnc,
        access_token_expires_at: input.accessTokenExpiresAt,
        scopes: input.scopes,
        credential_token_version: credential.token_version,
      };
      await tx.figma_connections.updateMany({
        where: { credential_id: credential.id },
        data: legacyTokenData,
      });

      let bound = false;
      let skipReason: string | null = null;
      if (
        input.allowProjectBinding &&
        operation.project_id &&
        operation.project_binding_generation !== null &&
        operation.initiated_by
      ) {
        await acquireAdvisoryLock(
          tx,
          projectBindingLockKey(operation.project_id)
        );
        const project = await tx.projects.findUnique({
          where: { id: operation.project_id },
          select: { figma_binding_generation: true },
        });
        if (
          project?.figma_binding_generation ===
          operation.project_binding_generation
        ) {
          const clearedVerification = verificationData({
            verifiedFileKey: null,
            verifiedFileName: null,
            verifiedAt: null,
            verificationError: null,
          });
          await tx.figma_connections.upsert({
            where: { project_id: operation.project_id },
            create: {
              project_id: operation.project_id,
              credential_id: credential.id,
              binding_generation: operation.project_binding_generation,
              authorized_by: operation.initiated_by,
              ...legacyTokenData,
              ...clearedVerification,
            },
            update: {
              credential_id: credential.id,
              binding_generation: operation.project_binding_generation,
              authorized_by: operation.initiated_by,
              ...legacyTokenData,
              ...clearedVerification,
            },
          });
          bound = true;
        } else {
          skipReason = 'project_binding_generation_changed';
        }
      } else {
        skipReason = 'project_authorization_changed';
      }

      await tx.figma_oauth_operations.update({
        where: { id: operation.id },
        data: {
          status: FigmaOAuthOperationStatus.finalized,
          credential_id: credential.id,
          pending_token_response_enc: null,
          pending_token_key_version: null,
          pending_access_token_expires_at: null,
          pending_scopes: null,
          pending_token_expires_at: null,
          completed_at: new Date(),
          project_binding_status: bound
            ? FigmaOAuthProjectBindingStatus.applied
            : FigmaOAuthProjectBindingStatus.skipped,
          project_binding_completed_at: new Date(),
          project_binding_skip_reason: skipReason,
        },
      });
      return { credential, bound };
    });
  }

  async finalizeRefreshOperation(input: {
    operationId: string;
    oauthAppKey: string;
    accessTokenEnc: string;
    refreshTokenEnc: string;
    accessTokenExpiresAt: Date;
    scopes: string;
    expectedEnvelopeEnc: string;
  }): Promise<FigmaCanonicalCredentialFull> {
    return prisma.$transaction(async (tx) => {
      const operation = await tx.figma_oauth_operations.findUnique({
        where: { id: input.operationId },
        select: OPERATION_SELECT,
      });
      if (
        !operation ||
        operation.status !== FigmaOAuthOperationStatus.response_received ||
        operation.kind !== FigmaOAuthOperationKind.token_refresh ||
        operation.oauth_app_key !== input.oauthAppKey ||
        !operation.credential_id ||
        operation.expected_token_version === null ||
        operation.pending_token_response_enc !== input.expectedEnvelopeEnc ||
        operation.pending_token_key_version !== 1 ||
        !operation.pending_token_expires_at ||
        operation.pending_token_expires_at <= new Date()
      ) {
        throw new FigmaOAuthOperationStaleError();
      }
      await acquireAdvisoryLock(
        tx,
        credentialIdLockKey(operation.credential_id)
      );
      const current = await tx.figma_oauth_credentials.findUnique({
        where: { id: operation.credential_id },
        select: {
          ...CREDENTIAL_FULL_SELECT,
          last_token_operation_sequence: true,
        },
      });
      if (!current || current.oauth_app_key !== input.oauthAppKey) {
        throw new FigmaOAuthOperationStaleError();
      }
      if (
        current.token_version !== operation.expected_token_version ||
        current.last_token_operation_sequence >= operation.journal_sequence
      ) {
        await tx.figma_oauth_operations.update({
          where: { id: operation.id },
          data: {
            status: FigmaOAuthOperationStatus.superseded,
            pending_token_response_enc: null,
            pending_token_key_version: null,
            pending_access_token_expires_at: null,
            pending_scopes: null,
            pending_token_expires_at: null,
            completed_at: new Date(),
          },
        });
        return current;
      }
      const credential = await tx.figma_oauth_credentials.update({
        where: { id: current.id },
        data: {
          access_token_enc: input.accessTokenEnc,
          refresh_token_enc: input.refreshTokenEnc,
          access_token_expires_at: input.accessTokenExpiresAt,
          scopes: input.scopes,
          status: FigmaOAuthCredentialStatus.active,
          token_version: { increment: 1 },
          last_validated_at: new Date(),
          last_token_operation_sequence: operation.journal_sequence,
          last_token_operation_id: operation.id,
        },
        select: CREDENTIAL_FULL_SELECT,
      });
      await tx.figma_connections.updateMany({
        where: { credential_id: credential.id },
        data: {
          figma_user_id: credential.figma_user_id,
          access_token_enc: credential.access_token_enc,
          refresh_token_enc: credential.refresh_token_enc,
          access_token_expires_at: credential.access_token_expires_at,
          scopes: credential.scopes,
          credential_token_version: credential.token_version,
        },
      });
      await tx.figma_oauth_operations.update({
        where: { id: operation.id },
        data: {
          status: FigmaOAuthOperationStatus.finalized,
          pending_token_response_enc: null,
          pending_token_key_version: null,
          pending_access_token_expires_at: null,
          pending_scopes: null,
          pending_token_expires_at: null,
          completed_at: new Date(),
        },
      });
      return credential;
    });
  }
}
