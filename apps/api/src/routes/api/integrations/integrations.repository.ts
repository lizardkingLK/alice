import { prisma } from '../../../lib/prisma';
import {
  prismaAuditCreateWithoutStatus,
  prismaAuditUpdate,
} from '../../../lib/prisma-audit';
import {
  IntegrationCategory,
  IntegrationStatus,
  Prisma,
  type integrations,
} from '@repo/types/prisma';
import {
  integrationDetailSelect,
  integrationListSelect,
  type IntegrationDetailRow,
  type IntegrationListRow,
  type ListIntegrationsQuery,
  type Database,
} from '@repo/types';
import { SupabaseClient } from '@supabase/supabase-js';

type IntegrationsTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function clearAiAgentDefaults(
  tx: IntegrationsTx,
  actorId: string,
  excludeId?: string
): Promise<void> {
  await tx.integrations.updateMany({
    where: {
      category: IntegrationCategory.ai_agent,
      is_default: true,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    data: {
      is_default: false,
      ...prismaAuditUpdate(actorId),
    },
  });
}

export type IntegrationCreateData = {
  actorId: string;
  catalog_id: string;
  category: IntegrationCategory;
  provider: string;
  name: string;
  status: IntegrationStatus;
  config: Prisma.InputJsonValue;
  is_default: boolean;
  sort_order: number;
};

export type IntegrationUpdateData = {
  actorId: string;
  id: string;
  catalog_id?: string;
  category?: IntegrationCategory;
  provider?: string;
  name?: string;
  status?: IntegrationStatus;
  config?: Prisma.InputJsonValue;
  is_default?: boolean;
  sort_order?: number;
};

export class IntegrationsRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async list(query: ListIntegrationsQuery): Promise<IntegrationListRow[]> {
    return prisma.integrations.findMany({
      where: {
        ...(query.category ? { category: query.category } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.catalog_id ? { catalog_id: query.catalog_id } : {}),
      },
      select: integrationListSelect,
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    });
  }

  async listActiveChatModels(): Promise<IntegrationListRow[]> {
    return prisma.integrations.findMany({
      where: {
        category: IntegrationCategory.ai_agent,
        status: IntegrationStatus.active,
      },
      select: integrationListSelect,
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    });
  }

  async findById(id: string): Promise<IntegrationDetailRow | null> {
    return prisma.integrations.findUnique({
      where: { id },
      select: integrationDetailSelect,
    });
  }

  async findActiveChatModelById(
    id: string
  ): Promise<IntegrationDetailRow | null> {
    return prisma.integrations.findFirst({
      where: {
        id,
        category: IntegrationCategory.ai_agent,
        status: IntegrationStatus.active,
      },
      select: integrationDetailSelect,
    });
  }

  async findDefaultActiveChatModel(): Promise<IntegrationDetailRow | null> {
    return prisma.integrations.findFirst({
      where: {
        category: IntegrationCategory.ai_agent,
        status: IntegrationStatus.active,
        is_default: true,
      },
      select: integrationDetailSelect,
    });
  }

  async create(data: IntegrationCreateData): Promise<IntegrationDetailRow> {
    return prisma.$transaction(async (tx) => {
      if (data.is_default && data.category === IntegrationCategory.ai_agent) {
        await clearAiAgentDefaults(tx, data.actorId);
      }

      return tx.integrations.create({
        data: {
          catalog_id: data.catalog_id,
          category: data.category,
          provider: data.provider,
          name: data.name,
          status: data.status,
          config: data.config,
          is_default: data.is_default,
          sort_order: data.sort_order,
          ...prismaAuditCreateWithoutStatus(data.actorId),
        },
        select: integrationDetailSelect,
      });
    });
  }

  async update(data: IntegrationUpdateData): Promise<IntegrationDetailRow> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.integrations.findUnique({
        where: { id: data.id },
        select: {
          category: true,
          status: true,
          is_default: true,
        },
      });

      if (!existing) {
        throw new Error('Integration not found');
      }

      const nextCategory = data.category ?? existing.category;
      const nextStatus = data.status ?? existing.status;
      const nextIsDefault = data.is_default ?? existing.is_default;

      if (
        nextIsDefault &&
        nextCategory === IntegrationCategory.ai_agent &&
        nextStatus === IntegrationStatus.active
      ) {
        await clearAiAgentDefaults(tx, data.actorId, data.id);
      }

      return tx.integrations.update({
        where: { id: data.id },
        data: {
          ...(data.catalog_id !== undefined
            ? { catalog_id: data.catalog_id }
            : {}),
          ...(data.category !== undefined ? { category: data.category } : {}),
          ...(data.provider !== undefined ? { provider: data.provider } : {}),
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.config !== undefined ? { config: data.config } : {}),
          ...(data.is_default !== undefined
            ? { is_default: data.is_default }
            : {}),
          ...(data.sort_order !== undefined
            ? { sort_order: data.sort_order }
            : {}),
          ...prismaAuditUpdate(data.actorId),
        },
        select: integrationDetailSelect,
      });
    });
  }

  async disable(id: string, actorId: string): Promise<void> {
    const result = await prisma.integrations.updateMany({
      where: { id },
      data: {
        status: IntegrationStatus.disabled,
        is_default: false,
        ...prismaAuditUpdate(actorId),
      },
    });

    if (result.count === 0) {
      throw new Error('Integration not found');
    }
  }
}

export type IntegrationRow = integrations;
