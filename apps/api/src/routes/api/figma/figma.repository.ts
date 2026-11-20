import { prisma } from '../../../lib/prisma';

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

      const consumed = await tx.figma_oauth_attempts.updateMany({
        where: { id: attempt.id, consumed_at: null },
        data: { consumed_at: new Date() },
      });
      return consumed.count === 1 ? attempt : null;
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

  updateTokens(
    projectId: string,
    input: { accessTokenEnc: string; accessTokenExpiresAt: Date }
  ): Promise<FigmaConnectionFull> {
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
    const result = await prisma.figma_connections.deleteMany({
      where: { project_id: projectId },
    });
    return result.count === 1;
  }
}
