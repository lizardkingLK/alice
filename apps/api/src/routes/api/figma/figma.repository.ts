import { Prisma, type FigmaOAuthCredentialStatus } from '@repo/types/prisma';
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
  await tx.$queryRaw(
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
    const result = await prisma.figma_connections.deleteMany({
      where: { project_id: projectId },
    });
    return result.count === 1;
  }
}
