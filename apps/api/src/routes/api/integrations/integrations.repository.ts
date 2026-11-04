import { prisma } from '../../../lib/prisma';
import {
  prismaAuditCreateWithoutStatus,
  prismaAuditUpdate,
} from '../../../lib/prisma-audit';
import { listAccessibleProjectIds } from '../../../lib/project-access';
import {
  IntegrationCategory,
  IntegrationScope,
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

  async listAccessibleProjectIds(actorId: string): Promise<string[]> {
    return listAccessibleProjectIds(this.db, actorId);
  }

  async list(query: ListIntegrationsQuery): Promise<IntegrationListRow[]> {
    return prisma.integrations.findMany({
      where: {
        ...(query.category ? { category: query.category } : {}),
        ...(query.scope ? { scope: query.scope } : {}),
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
        scope: IntegrationScope.organization,
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
        scope: IntegrationScope.organization,
        status: IntegrationStatus.active,
      },
      select: integrationDetailSelect,
    });
  }

  async findDefaultActiveChatModel(): Promise<IntegrationDetailRow | null> {
    return prisma.integrations.findFirst({
      where: {
        category: IntegrationCategory.ai_agent,
        scope: IntegrationScope.organization,
        status: IntegrationStatus.active,
        is_default: true,
      },
      select: integrationDetailSelect,
    });
  }

  async findMemberChatModelPreference(
    userId: string
  ): Promise<{ default_integration_id: string | null } | null> {
    return prisma.member_chat_model_preferences.findUnique({
      where: { user_id: userId },
      select: { default_integration_id: true },
    });
  }

  /**
   * Active org chat model preferred by the member, if still valid.
   */
  async findActiveMemberPreferredChatModel(
    userId: string
  ): Promise<IntegrationDetailRow | null> {
    const preference = await this.findMemberChatModelPreference(userId);
    if (!preference?.default_integration_id) {
      return null;
    }
    return this.findActiveChatModelById(preference.default_integration_id);
  }

  async upsertMemberChatModelPreference(params: {
    readonly userId: string;
    readonly defaultIntegrationId: string | null;
  }): Promise<{ default_integration_id: string | null }> {
    const { userId, defaultIntegrationId } = params;

    if (defaultIntegrationId) {
      const active = await this.findActiveChatModelById(defaultIntegrationId);
      if (!active) {
        throw new Error(
          'Preferred chat model must be an active organization AI model'
        );
      }
    }

    return prisma.member_chat_model_preferences.upsert({
      where: { user_id: userId },
      create: {
        user_id: userId,
        default_integration_id: defaultIntegrationId,
        updated_by: userId,
      },
      update: {
        default_integration_id: defaultIntegrationId,
        updated_by: userId,
      },
      select: { default_integration_id: true },
    });
  }

  /**
   * Active chat-model integrations bound to a project (org-scoped rows via
   * `project_integration_bindings`). Empty ⇒ caller falls through to org pool.
   */
  async listActiveChatModelBindingsForProject(projectId: string): Promise<
    Array<{
      integration_id: string;
      is_default_for_project: boolean;
      integration: IntegrationDetailRow;
    }>
  > {
    const rows = await prisma.project_integration_bindings.findMany({
      where: {
        project_id: projectId,
        integration: {
          category: IntegrationCategory.ai_agent,
          status: IntegrationStatus.active,
        },
      },
      select: {
        integration_id: true,
        is_default_for_project: true,
        integration: { select: integrationDetailSelect },
      },
      orderBy: [{ is_default_for_project: 'desc' }, { created_at: 'asc' }],
    });

    return rows.map((row) => ({
      integration_id: row.integration_id,
      is_default_for_project: row.is_default_for_project,
      integration: row.integration,
    }));
  }

  /**
   * Projects the actor can access that already have AI bindings, excluding
   * `excludeProjectId` (import-from sources).
   */
  async listProjectChatModelBindingImportSources(params: {
    readonly accessibleProjectIds: readonly string[];
    readonly excludeProjectId?: string;
  }): Promise<
    Array<{
      project_id: string;
      name: string;
      key: string;
      binding_count: number;
    }>
  > {
    const projectIds = params.accessibleProjectIds.filter(
      (id) => id !== params.excludeProjectId
    );
    if (projectIds.length === 0) {
      return [];
    }

    const grouped = await prisma.project_integration_bindings.groupBy({
      by: ['project_id'],
      where: {
        project_id: { in: [...projectIds] },
        integration: {
          category: IntegrationCategory.ai_agent,
          scope: IntegrationScope.organization,
          status: IntegrationStatus.active,
        },
      },
      _count: { _all: true },
    });

    if (grouped.length === 0) {
      return [];
    }

    const counts = new Map(
      grouped.map((row) => [row.project_id, row._count._all])
    );
    const projects = await prisma.projects.findMany({
      where: {
        id: { in: [...counts.keys()] },
        deleted_at: null,
      },
      select: { id: true, name: true, key: true },
      orderBy: { name: 'asc' },
    });

    return projects.map((project) => ({
      project_id: project.id,
      name: project.name,
      key: project.key,
      binding_count: counts.get(project.id) ?? 0,
    }));
  }

  /**
   * Replace all AI bindings for a project. Empty `bindings` clears the pool
   * (chat falls through to organization defaults).
   */
  async replaceProjectChatModelBindings(params: {
    readonly projectId: string;
    readonly actorId: string;
    readonly bindings: ReadonlyArray<{
      readonly integration_id: string;
      readonly is_default_for_project: boolean;
    }>;
  }): Promise<
    Array<{
      integration_id: string;
      is_default_for_project: boolean;
      integration: IntegrationDetailRow;
    }>
  > {
    const { projectId, actorId, bindings } = params;

    if (bindings.length > 0) {
      const ids = bindings.map((row) => row.integration_id);
      const activeOrgModels = await prisma.integrations.findMany({
        where: {
          id: { in: ids },
          category: IntegrationCategory.ai_agent,
          scope: IntegrationScope.organization,
          status: IntegrationStatus.active,
        },
        select: { id: true },
      });
      if (activeOrgModels.length !== ids.length) {
        throw new Error(
          'One or more integrations are not active organization AI models'
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.project_integration_bindings.deleteMany({
        where: { project_id: projectId },
      });

      if (bindings.length === 0) {
        return;
      }

      await tx.project_integration_bindings.createMany({
        data: bindings.map((row) => ({
          project_id: projectId,
          integration_id: row.integration_id,
          is_default_for_project: row.is_default_for_project,
          created_by: actorId,
          updated_by: actorId,
        })),
      });
    });

    return this.listActiveChatModelBindingsForProject(projectId);
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
          scope: IntegrationScope.organization,
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
