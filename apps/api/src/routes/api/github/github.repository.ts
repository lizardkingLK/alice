import { prisma } from '../../../lib/prisma';
import {
  prismaAuditCreateWithoutStatus,
  prismaAuditUpdate,
} from '../../../lib/prisma-audit';
import {
  IntegrationCategory,
  IntegrationStatus,
  Prisma,
  UserRole,
  type integrations,
} from '@repo/types/prisma';

export const GITHUB_PROVIDER = 'github';
export const GITHUB_CATALOG_ID = 'github';

export type IntegrationWithCreator = integrations & {
  created_by_user?: {
    id: string;
    name: string;
    role: UserRole;
  } | null;
};

export class GithubRepository {
  async findActive(userId?: string): Promise<IntegrationWithCreator | null> {
    if (userId) {
      const userIntegration = await prisma.integrations.findFirst({
        where: {
          provider: GITHUB_PROVIDER,
          status: IntegrationStatus.active,
          created_by: userId,
        },
        include: {
          created_by_user: {
            select: { id: true, name: true, role: true },
          },
        },
        orderBy: { updated_at: 'desc' },
      });
      if (userIntegration) {
        return userIntegration;
      }
    }

    return prisma.integrations.findFirst({
      where: {
        provider: GITHUB_PROVIDER,
        status: IntegrationStatus.active,
      },
      include: {
        created_by_user: {
          select: { id: true, name: true, role: true },
        },
      },
      orderBy: { updated_at: 'desc' },
    });
  }

  async findActiveAdminConnection(): Promise<IntegrationWithCreator | null> {
    return prisma.integrations.findFirst({
      where: {
        provider: GITHUB_PROVIDER,
        status: IntegrationStatus.active,
        created_by_user: {
          role: UserRole.admin,
        },
      },
      include: {
        created_by_user: {
          select: { id: true, name: true, role: true },
        },
      },
      orderBy: { updated_at: 'desc' },
    });
  }

  async getUserById(userId: string) {
    return prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, name: true, role: true },
    });
  }

  async listByUserId(userId: string): Promise<IntegrationWithCreator[]> {
    return prisma.integrations.findMany({
      where: {
        provider: GITHUB_PROVIDER,
        status: IntegrationStatus.active,
        created_by: userId,
      },
      include: {
        created_by_user: {
          select: { id: true, name: true, role: true },
        },
      },
      orderBy: { updated_at: 'desc' },
    });
  }

  async listAllActive(): Promise<IntegrationWithCreator[]> {
    return prisma.integrations.findMany({
      where: {
        provider: GITHUB_PROVIDER,
        status: IntegrationStatus.active,
      },
      include: {
        created_by_user: {
          select: { id: true, name: true, role: true },
        },
      },
      orderBy: { updated_at: 'desc' },
    });
  }

  async findById(id: string): Promise<IntegrationWithCreator | null> {
    return prisma.integrations.findUnique({
      where: { id },
      include: {
        created_by_user: {
          select: { id: true, name: true, role: true },
        },
      },
    });
  }

  async findByIdForUser(
    id: string,
    userId: string
  ): Promise<IntegrationWithCreator | null> {
    return prisma.integrations.findFirst({
      where: {
        id,
        provider: GITHUB_PROVIDER,
        created_by: userId,
      },
      include: {
        created_by_user: {
          select: { id: true, name: true, role: true },
        },
      },
    });
  }

  async upsertConnection(data: {
    userId: string;
    name: string;
    config: Prisma.InputJsonValue;
    status?: IntegrationStatus;
  }): Promise<integrations> {
    const existing = await prisma.integrations.findFirst({
      where: {
        provider: GITHUB_PROVIDER,
        created_by: data.userId,
      },
      orderBy: { updated_at: 'desc' },
    });

    if (existing) {
      return prisma.integrations.update({
        where: { id: existing.id },
        data: {
          name: data.name,
          config: data.config,
          status: data.status ?? IntegrationStatus.active,
          ...prismaAuditUpdate(data.userId),
        },
      });
    }

    return prisma.integrations.create({
      data: {
        catalog_id: GITHUB_CATALOG_ID,
        category: IntegrationCategory.productivity,
        provider: GITHUB_PROVIDER,
        name: data.name,
        status: data.status ?? IntegrationStatus.active,
        config: data.config,
        is_default: false,
        sort_order: 0,
        ...prismaAuditCreateWithoutStatus(data.userId),
      },
    });
  }

  async updateConfig(
    id: string,
    config: Prisma.InputJsonValue,
    status?: IntegrationStatus,
    actorId?: string
  ): Promise<integrations> {
    return prisma.integrations.update({
      where: { id },
      data: {
        config,
        ...(status ? { status } : {}),
        ...(actorId ? prismaAuditUpdate(actorId) : { updated_at: new Date() }),
      },
    });
  }

  async updateStatus(
    id: string,
    status: IntegrationStatus,
    actorId?: string
  ): Promise<void> {
    await prisma.integrations.update({
      where: { id },
      data: {
        status,
        ...(actorId ? prismaAuditUpdate(actorId) : { updated_at: new Date() }),
      },
    });
  }

  async deleteById(id: string, actorId: string): Promise<boolean> {
    const existing = await prisma.integrations.findFirst({
      where: { id, provider: GITHUB_PROVIDER },
    });

    if (!existing) {
      return false;
    }

    await prisma.integrations.update({
      where: { id },
      data: {
        status: IntegrationStatus.disabled,
        ...prismaAuditUpdate(actorId),
      },
    });

    return true;
  }
}
