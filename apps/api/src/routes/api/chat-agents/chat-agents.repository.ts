import { prisma } from '../../../lib/prisma';
import {
  prismaAuditCreateWithoutStatus,
  prismaAuditUpdate,
} from '../../../lib/prisma-audit';
import {
  ChatAgentAutonomy,
  RecordStatus,
  type Prisma,
} from '@repo/types/prisma';
import {
  chatAgentDetailSelect,
  chatAgentListSelect,
  type ChatAgentDetailRow,
  type ChatAgentListRow,
  type ListChatAgentsQuery,
} from '@repo/types';

export type ChatAgentEnablement = {
  enabledToolKeys: string[];
  enabledSkillKeys: string[];
};

export type ChatToolCatalogRow = {
  id: string;
  key: string;
  label: string;
  description: string;
  sort_order: number;
  status: RecordStatus;
  instruction: string | null;
};

export type ChatSkillCatalogRow = {
  id: string;
  key: string;
  label: string;
  description: string;
  sort_order: number;
  status: RecordStatus;
};

export type CreateForkInput = {
  actorId: string;
  source: ChatAgentDetailRow;
  instructionsCiphertext: string;
  enabledToolIds: string[];
  enabledSkillIds: string[];
  name: string;
  title: string;
};

export type PatchAgentInput = {
  actorId: string;
  id: string;
  name?: string;
  title?: string;
  description?: string;
  instructionsCiphertext?: string;
  autonomy?: ChatAgentAutonomy;
  status?: 'active' | 'archived';
  tagline?: string;
  avatarStyle?: string;
  avatarSeed?: string;
  toolToggles?: Array<{ toolId: string; enabled: boolean }>;
  skillToggles?: Array<{ skillId: string; enabled: boolean }>;
};

type ChatAgentsTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

function visibleAgentWhere(actorId: string): Prisma.chat_agentsWhereInput {
  return {
    OR: [{ owner_id: null }, { owner_id: actorId }],
  };
}

function upsertAgentEnablementToggle(
  tx: ChatAgentsTx,
  kind: 'tool' | 'skill',
  agentId: string,
  targetId: string,
  enabled: boolean,
  toggledAt: Date
) {
  const update = { enabled, updated_at: toggledAt };
  if (kind === 'tool') {
    return tx.chat_agent_tools.upsert({
      where: { agent_id_tool_id: { agent_id: agentId, tool_id: targetId } },
      create: { agent_id: agentId, tool_id: targetId, enabled },
      update,
    });
  }
  return tx.chat_agent_skills.upsert({
    where: { agent_id_skill_id: { agent_id: agentId, skill_id: targetId } },
    create: { agent_id: agentId, skill_id: targetId, enabled },
    update,
  });
}

export class ChatAgentsRepository {
  listVisible(
    actorId: string,
    query: ListChatAgentsQuery
  ): Promise<ChatAgentListRow[]> {
    let statusFilter = undefined;
    if (query.status === 'archived') {
      statusFilter = RecordStatus.archived;
    } else if (query.status === 'active') {
      statusFilter = RecordStatus.active;
    }

    return prisma.chat_agents.findMany({
      where: {
        ...visibleAgentWhere(actorId),
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      select: chatAgentListSelect,
      orderBy: [{ is_default: 'desc' }, { owner_id: 'asc' }, { name: 'asc' }],
    });
  }

  findVisibleById(
    actorId: string,
    id: string
  ): Promise<ChatAgentDetailRow | null> {
    return prisma.chat_agents.findFirst({
      where: {
        id,
        ...visibleAgentWhere(actorId),
      },
      select: chatAgentDetailSelect,
    });
  }

  findById(id: string): Promise<ChatAgentDetailRow | null> {
    return prisma.chat_agents.findUnique({
      where: { id },
      select: chatAgentDetailSelect,
    });
  }

  countActiveAgents(): Promise<number> {
    return prisma.chat_agents.count({
      where: { status: RecordStatus.active },
    });
  }

  findActiveDefault(): Promise<ChatAgentDetailRow | null> {
    return prisma.chat_agents.findFirst({
      where: {
        is_default: true,
        status: RecordStatus.active,
      },
      select: chatAgentDetailSelect,
    });
  }

  findExistingFork(
    actorId: string,
    forkedFromId: string
  ): Promise<ChatAgentListRow | null> {
    return prisma.chat_agents.findFirst({
      where: {
        owner_id: actorId,
        forked_from_id: forkedFromId,
        status: RecordStatus.active,
      },
      select: chatAgentListSelect,
    });
  }

  async listEnablementForAgents(
    agentIds: string[]
  ): Promise<Map<string, ChatAgentEnablement>> {
    const result = new Map<string, ChatAgentEnablement>();
    for (const agentId of agentIds) {
      result.set(agentId, { enabledToolKeys: [], enabledSkillKeys: [] });
    }
    if (agentIds.length === 0) {
      return result;
    }

    const [toolLinks, skillLinks] = await Promise.all([
      prisma.chat_agent_tools.findMany({
        where: { agent_id: { in: agentIds }, enabled: true },
        select: {
          agent_id: true,
          tool: { select: { key: true } },
        },
      }),
      prisma.chat_agent_skills.findMany({
        where: { agent_id: { in: agentIds }, enabled: true },
        select: {
          agent_id: true,
          skill: { select: { key: true } },
        },
      }),
    ]);

    for (const link of toolLinks) {
      result.get(link.agent_id)?.enabledToolKeys.push(link.tool.key);
    }
    for (const link of skillLinks) {
      result.get(link.agent_id)?.enabledSkillKeys.push(link.skill.key);
    }

    return result;
  }

  listActiveTools(): Promise<ChatToolCatalogRow[]> {
    return prisma.chat_tools.findMany({
      where: { status: RecordStatus.active },
      select: {
        id: true,
        key: true,
        label: true,
        description: true,
        sort_order: true,
        status: true,
        instruction: true,
      },
      orderBy: { sort_order: 'asc' },
    });
  }

  listActiveSkills(): Promise<ChatSkillCatalogRow[]> {
    return prisma.chat_skills.findMany({
      where: { status: RecordStatus.active },
      select: {
        id: true,
        key: true,
        label: true,
        description: true,
        sort_order: true,
        status: true,
      },
      orderBy: { sort_order: 'asc' },
    });
  }

  private async findCatalogIdsByKeys(
    kind: 'tool' | 'skill',
    keys: string[]
  ): Promise<Map<string, string>> {
    if (keys.length === 0) {
      return new Map();
    }
    const rows =
      kind === 'tool'
        ? await prisma.chat_tools.findMany({
            where: { key: { in: keys } },
            select: { id: true, key: true },
          })
        : await prisma.chat_skills.findMany({
            where: { key: { in: keys } },
            select: { id: true, key: true },
          });
    return new Map(rows.map((row) => [row.key, row.id]));
  }

  findToolIdsByKeys(keys: string[]): Promise<Map<string, string>> {
    return this.findCatalogIdsByKeys('tool', keys);
  }

  findSkillIdsByKeys(keys: string[]): Promise<Map<string, string>> {
    return this.findCatalogIdsByKeys('skill', keys);
  }

  private async listEnabledTargetIds(
    kind: 'tool' | 'skill',
    agentId: string
  ): Promise<string[]> {
    if (kind === 'tool') {
      const rows = await prisma.chat_agent_tools.findMany({
        where: { agent_id: agentId, enabled: true },
        select: { tool_id: true },
      });
      return rows.map((row) => row.tool_id);
    }
    const rows = await prisma.chat_agent_skills.findMany({
      where: { agent_id: agentId, enabled: true },
      select: { skill_id: true },
    });
    return rows.map((row) => row.skill_id);
  }

  listEnabledToolIds(agentId: string): Promise<string[]> {
    return this.listEnabledTargetIds('tool', agentId);
  }

  listEnabledSkillIds(agentId: string): Promise<string[]> {
    return this.listEnabledTargetIds('skill', agentId);
  }

  createFork(input: CreateForkInput): Promise<ChatAgentDetailRow> {
    return prisma.$transaction(async (tx) => {
      const created = await tx.chat_agents.create({
        data: {
          key: null,
          owner_id: input.actorId,
          name: input.name,
          title: input.title,
          description: input.source.description,
          instructions: input.instructionsCiphertext,
          autonomy: input.source.autonomy,
          status: RecordStatus.active,
          version: input.source.version + 1,
          forked_from_id: input.source.id,
          is_default: false,
          tagline: input.source.tagline,
          avatar_style: input.source.avatar_style,
          avatar_seed: input.source.avatar_seed,
          ...prismaAuditCreateWithoutStatus(input.actorId),
        },
        select: chatAgentDetailSelect,
      });

      if (input.enabledToolIds.length > 0) {
        await tx.chat_agent_tools.createMany({
          data: input.enabledToolIds.map((toolId) => ({
            agent_id: created.id,
            tool_id: toolId,
            enabled: true,
          })),
        });
      }

      if (input.enabledSkillIds.length > 0) {
        await tx.chat_agent_skills.createMany({
          data: input.enabledSkillIds.map((skillId) => ({
            agent_id: created.id,
            skill_id: skillId,
            enabled: true,
          })),
        });
      }

      return created;
    });
  }

  patchAgent(input: PatchAgentInput): Promise<ChatAgentDetailRow> {
    return prisma.$transaction(async (tx) => {
      const data: Prisma.chat_agentsUpdateInput = {
        ...prismaAuditUpdate(input.actorId),
      };

      if (input.name !== undefined) {
        data.name = input.name;
      }
      if (input.title !== undefined) {
        data.title = input.title;
      }
      if (input.description !== undefined) {
        data.description = input.description;
      }
      if (input.instructionsCiphertext !== undefined) {
        data.instructions = input.instructionsCiphertext;
      }
      if (input.autonomy !== undefined) {
        data.autonomy = input.autonomy;
      }
      if (input.status !== undefined) {
        data.status = input.status;
      }
      if (input.tagline !== undefined) {
        data.tagline = input.tagline;
      }
      if (input.avatarStyle !== undefined) {
        data.avatar_style = input.avatarStyle;
      }
      if (input.avatarSeed !== undefined) {
        data.avatar_seed = input.avatarSeed;
      }

      const updated = await tx.chat_agents.update({
        where: { id: input.id },
        data,
        select: chatAgentDetailSelect,
      });

      const toolToggles = input.toolToggles ?? [];
      const skillToggles = input.skillToggles ?? [];
      const toggledAt = new Date();

      await Promise.all([
        ...toolToggles.map((toggle) =>
          upsertAgentEnablementToggle(
            tx,
            'tool',
            input.id,
            toggle.toolId,
            toggle.enabled,
            toggledAt
          )
        ),
        ...skillToggles.map((toggle) =>
          upsertAgentEnablementToggle(
            tx,
            'skill',
            input.id,
            toggle.skillId,
            toggle.enabled,
            toggledAt
          )
        ),
      ]);

      return updated;
    });
  }

  async deleteAgent(id: string): Promise<void> {
    await prisma.chat_agents.delete({ where: { id } });
  }

  setDefault(actorId: string, id: string): Promise<ChatAgentDetailRow> {
    return prisma.$transaction(async (tx) => {
      await tx.chat_agents.updateMany({
        where: { is_default: true, id: { not: id } },
        data: {
          is_default: false,
          ...prismaAuditUpdate(actorId),
        },
      });

      return tx.chat_agents.update({
        where: { id },
        data: {
          is_default: true,
          status: RecordStatus.active,
          ...prismaAuditUpdate(actorId),
        },
        select: chatAgentDetailSelect,
      });
    });
  }

  findOldestActiveAgent(): Promise<ChatAgentDetailRow | null> {
    return prisma.chat_agents.findFirst({
      where: { status: RecordStatus.active },
      select: chatAgentDetailSelect,
      orderBy: { created_at: 'asc' },
    });
  }
}
