import { requireUserWithRole } from '../../../lib/auth-helpers';
import {
  decryptSecret,
  encryptSecret,
} from '../../../lib/secrets/token-crypto';
import {
  UserRoleEnum,
  type ChatAgentDetailRow,
  type ChatAgentDetailWire,
  type ChatAgentListRow,
  type ChatAgentSummaryWire,
  type ChatSkillCatalogWire,
  type ChatToolCatalogWire,
  type ListChatAgentsQuery,
  type PatchChatAgentBody,
} from '@repo/types';
import type {
  ChatAgentEnablement,
  ChatAgentsRepository,
} from './chat-agents.repository';

const EMPTY_ENABLEMENT: ChatAgentEnablement = {
  enabledToolKeys: [],
  enabledSkillKeys: [],
};

async function requireAdmin(actorId: string) {
  return requireUserWithRole(
    actorId,
    [UserRoleEnum.admin],
    'Unauthorized. Only administrators can manage workspace chat agents.'
  );
}

function toIso(value: Date): string {
  return value.toISOString();
}

function kindOf(
  row: Pick<ChatAgentListRow, 'owner_id'>
): 'system' | 'personal' {
  return row.owner_id == null ? 'system' : 'personal';
}

function enablementFor(
  map: Map<string, ChatAgentEnablement>,
  agentId: string
): ChatAgentEnablement {
  return map.get(agentId) ?? EMPTY_ENABLEMENT;
}

function assertCanMutate(
  actorId: string,
  actorRole: string,
  agent: Pick<ChatAgentDetailRow, 'owner_id'>
): void {
  if (agent.owner_id == null) {
    if (actorRole !== UserRoleEnum.admin) {
      throw new Error(
        'Unauthorized. Only administrators can edit workspace agents.'
      );
    }
    return;
  }

  if (agent.owner_id !== actorId) {
    throw new Error('Unauthorized. You can only edit your own agent forks.');
  }
}

export class ChatAgentsService {
  constructor(private readonly repository: ChatAgentsRepository) {}

  private toSummaryWire(
    row: ChatAgentListRow,
    enablement: ChatAgentEnablement
  ): ChatAgentSummaryWire {
    return {
      id: row.id,
      key: row.key,
      ownerId: row.owner_id,
      name: row.name,
      title: row.title,
      description: row.description,
      autonomy: row.autonomy,
      status: row.status,
      version: row.version,
      forkedFromId: row.forked_from_id,
      isDefault: row.is_default,
      tagline: row.tagline,
      avatarStyle: row.avatar_style,
      avatarSeed: row.avatar_seed,
      kind: kindOf(row),
      enabledToolKeys: enablement.enabledToolKeys,
      enabledSkillKeys: enablement.enabledSkillKeys,
      createdBy: row.created_by,
      createdAt: toIso(row.created_at),
      updatedBy: row.updated_by,
      updatedAt: toIso(row.updated_at),
    };
  }

  private toDetailWire(
    row: ChatAgentDetailRow,
    enablement: ChatAgentEnablement
  ): ChatAgentDetailWire {
    return {
      ...this.toSummaryWire(row, enablement),
      instructions: decryptSecret(row.instructions),
    };
  }

  async listAgents(
    actorId: string,
    query: ListChatAgentsQuery
  ): Promise<ChatAgentSummaryWire[]> {
    const rows = await this.repository.listVisible(actorId, query);
    const enablement = await this.repository.listEnablementForAgents(
      rows.map((row) => row.id)
    );

    return rows.map((row) =>
      this.toSummaryWire(row, enablementFor(enablement, row.id))
    );
  }

  async getAgent(actorId: string, id: string): Promise<ChatAgentDetailWire> {
    const row = await this.repository.findVisibleById(actorId, id);
    if (!row) {
      throw new Error('Chat agent not found.');
    }

    const enablement = await this.repository.listEnablementForAgents([row.id]);
    return this.toDetailWire(row, enablementFor(enablement, row.id));
  }

  async listTools(_actorId: string): Promise<ChatToolCatalogWire[]> {
    const rows = await this.repository.listActiveTools();
    return rows.map((row) => ({
      id: row.id,
      key: row.key,
      label: row.label,
      description: row.description,
      sortOrder: row.sort_order,
      status: row.status,
      hasInstruction: Boolean(row.instruction),
    }));
  }

  async listSkills(_actorId: string): Promise<ChatSkillCatalogWire[]> {
    const rows = await this.repository.listActiveSkills();
    return rows.map((row) => ({
      id: row.id,
      key: row.key,
      label: row.label,
      description: row.description,
      sortOrder: row.sort_order,
      status: row.status,
    }));
  }

  async forkAgent(
    actorId: string,
    sourceId: string
  ): Promise<ChatAgentDetailWire> {
    const source = await this.repository.findVisibleById(actorId, sourceId);
    if (!source) {
      throw new Error('Chat agent not found.');
    }
    if (source.owner_id != null) {
      throw new Error('Only workspace agents can be forked.');
    }
    if (source.status !== 'active') {
      throw new Error('Only active workspace agents can be forked.');
    }

    const existing = await this.repository.findExistingFork(actorId, source.id);
    if (existing) {
      throw new Error(
        'You already forked this workspace agent. Edit your existing fork instead.'
      );
    }

    const [toolIds, skillIds] = await Promise.all([
      this.repository.listEnabledToolIds(source.id),
      this.repository.listEnabledSkillIds(source.id),
    ]);

    const plaintext = decryptSecret(source.instructions);
    const created = await this.repository.createFork({
      actorId,
      source,
      instructionsCiphertext: encryptSecret(plaintext),
      enabledToolIds: toolIds,
      enabledSkillIds: skillIds,
      name: source.name,
      title: source.title,
    });

    const enablement = await this.repository.listEnablementForAgents([
      created.id,
    ]);
    return this.toDetailWire(created, enablementFor(enablement, created.id));
  }

  async patchAgent(
    actorId: string,
    id: string,
    body: PatchChatAgentBody
  ): Promise<ChatAgentDetailWire> {
    const agent = await this.repository.findVisibleById(actorId, id);
    if (!agent) {
      throw new Error('Chat agent not found.');
    }

    const actor = await requireUserWithRole(
      actorId,
      [UserRoleEnum.admin, UserRoleEnum.manager, UserRoleEnum.member],
      'Unauthorized.'
    );
    assertCanMutate(actorId, actor.role, agent);

    if (body.status === 'archived' && agent.is_default) {
      throw new Error(
        'Cannot archive the workspace default agent. Set another default first.'
      );
    }

    if (body.status === 'archived') {
      const activeCount = await this.repository.countActiveAgents();
      if (activeCount <= 1 && agent.status === 'active') {
        throw new Error('Cannot archive the last active chat agent.');
      }
    }

    const toolKeys = (body.enabledTools ?? []).map((item) => item.key);
    const skillKeys = (body.enabledSkills ?? []).map((item) => item.key);
    const [toolIds, skillIds] = await Promise.all([
      this.repository.findToolIdsByKeys(toolKeys),
      this.repository.findSkillIdsByKeys(skillKeys),
    ]);

    for (const key of toolKeys) {
      if (!toolIds.has(key)) {
        throw new Error(`Unknown chat tool key: ${key}`);
      }
    }
    for (const key of skillKeys) {
      if (!skillIds.has(key)) {
        throw new Error(`Unknown chat skill key: ${key}`);
      }
    }

    const updated = await this.repository.patchAgent({
      actorId,
      id,
      name: body.name,
      title: body.title,
      description: body.description,
      instructionsCiphertext:
        body.instructions !== undefined
          ? encryptSecret(body.instructions)
          : undefined,
      autonomy: body.autonomy,
      status: body.status,
      tagline: body.tagline,
      avatarStyle: body.avatarStyle,
      avatarSeed: body.avatarSeed,
      toolToggles: (body.enabledTools ?? []).map((item) => ({
        toolId: toolIds.get(item.key)!,
        enabled: item.enabled,
      })),
      skillToggles: (body.enabledSkills ?? []).map((item) => ({
        skillId: skillIds.get(item.key)!,
        enabled: item.enabled,
      })),
    });

    const enablement = await this.repository.listEnablementForAgents([
      updated.id,
    ]);
    return this.toDetailWire(updated, enablementFor(enablement, updated.id));
  }

  async deleteAgent(actorId: string, id: string): Promise<void> {
    const agent = await this.repository.findVisibleById(actorId, id);
    if (!agent) {
      throw new Error('Chat agent not found.');
    }

    const actor = await requireUserWithRole(
      actorId,
      [UserRoleEnum.admin, UserRoleEnum.manager, UserRoleEnum.member],
      'Unauthorized.'
    );
    assertCanMutate(actorId, actor.role, agent);

    if (agent.status === 'active') {
      const activeCount = await this.repository.countActiveAgents();
      if (activeCount <= 1) {
        throw new Error('Cannot delete the last active chat agent.');
      }
    }

    const wasDefault = agent.is_default;
    await this.repository.deleteAgent(id);

    if (wasDefault) {
      const nextDefault = await this.repository.findOldestActiveAgent();
      if (nextDefault) {
        await this.repository.setDefault(actorId, nextDefault.id);
      }
    }
  }

  async setDefault(actorId: string, id: string): Promise<ChatAgentDetailWire> {
    await requireAdmin(actorId);

    const agent = await this.repository.findById(id);
    if (!agent) {
      throw new Error('Chat agent not found.');
    }
    if (agent.owner_id != null) {
      throw new Error('Only workspace agents can be the global default.');
    }
    if (agent.status !== 'active') {
      throw new Error('Only active workspace agents can be the default.');
    }

    const updated = await this.repository.setDefault(actorId, id);
    const enablement = await this.repository.listEnablementForAgents([
      updated.id,
    ]);
    return this.toDetailWire(updated, enablementFor(enablement, updated.id));
  }
}
