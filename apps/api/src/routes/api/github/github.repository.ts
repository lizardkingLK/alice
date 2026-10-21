import {
  buildGithubProviderConfig,
  tryParseGithubProviderConfig,
} from '@repo/types';
import {
  VersionControlConnectionStatus,
  VersionControlVendor,
  UserRole,
  type Prisma,
} from '@repo/types/prisma';
import { prisma } from '../../../lib/prisma';

const PUBLIC_SELECT = {
  id: true,
  user_id: true,
  vendor: true,
  external_id: true,
  display_label: true,
  provider_config: true,
  scopes: true,
  status: true,
  created_at: true,
  updated_at: true,
  user: { select: { id: true, name: true, role: true } },
} as const;

const FULL_SELECT = {
  ...PUBLIC_SELECT,
  refresh_token_enc: true,
  access_token_enc: true,
  access_token_expires_at: true,
} as const;

export type VcConnectionPublic = {
  id: string;
  user_id: string;
  vendor: VersionControlVendor;
  external_id: string;
  display_label: string | null;
  provider_config: Prisma.JsonValue;
  scopes: string;
  status: VersionControlConnectionStatus;
  created_at: Date;
  updated_at: Date;
  user: { id: string; name: string; role: UserRole } | null;
};

export type VcConnectionFull = VcConnectionPublic & {
  refresh_token_enc: string;
  access_token_enc: string | null;
  access_token_expires_at: Date | null;
};

export type UpsertGithubConnectionInput = {
  userId: string;
  externalId: string;
  displayLabel: string;
  providerConfig: ReturnType<typeof buildGithubProviderConfig>;
  refreshTokenEnc: string;
  accessTokenEnc: string | null;
  accessTokenExpiresAt: Date | null;
  scopes: string;
  status?: VersionControlConnectionStatus;
};

export class GithubRepository {
  async findActive(userId?: string): Promise<VcConnectionFull | null> {
    if (userId) {
      const userRow = await prisma.version_control_connections.findFirst({
        where: {
          vendor: VersionControlVendor.github,
          status: VersionControlConnectionStatus.active,
          user_id: userId,
        },
        select: FULL_SELECT,
        orderBy: { updated_at: 'desc' },
      });
      if (userRow) {
        return userRow;
      }
    }

    return prisma.version_control_connections.findFirst({
      where: {
        vendor: VersionControlVendor.github,
        status: VersionControlConnectionStatus.active,
      },
      select: FULL_SELECT,
      orderBy: { updated_at: 'desc' },
    });
  }

  findActiveAdminConnection(): Promise<VcConnectionFull | null> {
    return prisma.version_control_connections.findFirst({
      where: {
        vendor: VersionControlVendor.github,
        status: VersionControlConnectionStatus.active,
        user: { role: UserRole.admin },
      },
      select: FULL_SELECT,
      orderBy: { updated_at: 'desc' },
    });
  }

  getUserById(userId: string) {
    return prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, name: true, role: true },
    });
  }

  listByUserId(userId: string): Promise<VcConnectionPublic[]> {
    return prisma.version_control_connections.findMany({
      where: {
        vendor: VersionControlVendor.github,
        status: VersionControlConnectionStatus.active,
        user_id: userId,
      },
      select: PUBLIC_SELECT,
      orderBy: { updated_at: 'desc' },
    });
  }

  listAllActive(): Promise<VcConnectionPublic[]> {
    return prisma.version_control_connections.findMany({
      where: {
        vendor: VersionControlVendor.github,
        status: VersionControlConnectionStatus.active,
      },
      select: PUBLIC_SELECT,
      orderBy: { updated_at: 'desc' },
    });
  }

  findById(id: string): Promise<VcConnectionFull | null> {
    return prisma.version_control_connections.findFirst({
      where: { id, vendor: VersionControlVendor.github },
      select: FULL_SELECT,
    });
  }

  findByIdForUser(
    id: string,
    userId: string
  ): Promise<VcConnectionFull | null> {
    return prisma.version_control_connections.findFirst({
      where: {
        id,
        user_id: userId,
        vendor: VersionControlVendor.github,
      },
      select: FULL_SELECT,
    });
  }

  async upsertConnection(
    data: UpsertGithubConnectionInput
  ): Promise<VcConnectionFull> {
    const existing = await prisma.version_control_connections.findFirst({
      where: {
        vendor: VersionControlVendor.github,
        user_id: data.userId,
        external_id: data.externalId,
      },
      select: { id: true },
    });

    const payload = {
      display_label: data.displayLabel,
      provider_config: data.providerConfig as Prisma.InputJsonValue,
      refresh_token_enc: data.refreshTokenEnc,
      access_token_enc: data.accessTokenEnc,
      access_token_expires_at: data.accessTokenExpiresAt,
      scopes: data.scopes,
      status: data.status ?? VersionControlConnectionStatus.active,
      updated_at: new Date(),
    };

    if (existing) {
      return prisma.version_control_connections.update({
        where: { id: existing.id },
        data: payload,
        select: FULL_SELECT,
      });
    }

    return prisma.version_control_connections.create({
      data: {
        user_id: data.userId,
        vendor: VersionControlVendor.github,
        external_id: data.externalId,
        ...payload,
      },
      select: FULL_SELECT,
    });
  }

  async updateTokens(
    id: string,
    data: {
      accessTokenEnc: string;
      refreshTokenEnc?: string | null;
      accessTokenExpiresAt: Date | null;
      scopes?: string;
      providerConfigPatch?: Record<string, unknown>;
    }
  ): Promise<VcConnectionFull> {
    const current = await this.findById(id);
    const mergedConfig = {
      ...tryParseGithubProviderConfig(current?.provider_config),
      ...data.providerConfigPatch,
    };

    return prisma.version_control_connections.update({
      where: { id },
      data: {
        access_token_enc: data.accessTokenEnc,
        ...(data.refreshTokenEnc !== undefined
          ? { refresh_token_enc: data.refreshTokenEnc ?? '' }
          : {}),
        access_token_expires_at: data.accessTokenExpiresAt,
        ...(data.scopes ? { scopes: data.scopes } : {}),
        provider_config: mergedConfig as Prisma.InputJsonValue,
        updated_at: new Date(),
      },
      select: FULL_SELECT,
    });
  }

  async updateStatus(
    id: string,
    status: VersionControlConnectionStatus
  ): Promise<void> {
    await prisma.version_control_connections.update({
      where: { id },
      data: { status, updated_at: new Date() },
    });
  }

  async deleteById(id: string): Promise<boolean> {
    const existing = await prisma.version_control_connections.findFirst({
      where: { id, vendor: VersionControlVendor.github },
      select: { id: true },
    });

    if (!existing) {
      return false;
    }

    await prisma.version_control_connections.update({
      where: { id },
      data: {
        status: VersionControlConnectionStatus.revoked,
        updated_at: new Date(),
      },
    });

    return true;
  }
}
