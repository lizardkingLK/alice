import type {
  ChatAgentDetailWire,
  ChatAgentSummaryWire,
  PatchChatAgentBody,
} from '@repo/types/api/v1';
import {
  buildDicebearAvatarUrl,
  defaultAvatarSeedForAgent,
  isChatAgentAvatarStyle,
  type ChatAgentAvatarStyle,
} from '@/app/chat/_helpers/chat-agent-avatar';
import { getPreferredChatAgentId } from '@/app/chat/_helpers/preferred-chat-agent-storage';

export type ChatAgentKind = 'system' | 'personal';

export type ChatAgentAutonomy = 'suggest' | 'approve';

export type ChatAgentStatus = 'active' | 'archived';

/** UI agent row mapped from chat-agents API wire. */
export type ChatAgentRecord = {
  readonly id: string;
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly instructions: string;
  readonly kind: ChatAgentKind;
  readonly autonomy: ChatAgentAutonomy;
  readonly status: ChatAgentStatus;
  readonly version: number;
  readonly forkedFromId: string | null;
  readonly tagline: string;
  /** Newline-separated skill keys for the customize form. */
  readonly skills: string;
  /** Newline-separated tool keys for the customize form. */
  readonly tools: string;
  readonly enabledSkillKeys: readonly string[];
  readonly enabledToolKeys: readonly string[];
  readonly avatarStyle: ChatAgentAvatarStyle;
  readonly avatarSeed: string;
  readonly isDefault: boolean;
  readonly authorName: string;
};

/** Display byline for workspace (system) agents. */
export const ALICE_SYSTEM_AUTHOR = {
  name: 'Alice',
  email: 'admin@alice.dev',
} as const;

function resolveAvatarFields(wire: {
  readonly id: string;
  readonly name: string;
  readonly avatarStyle: string;
  readonly avatarSeed: string;
}): {
  avatarStyle: ChatAgentAvatarStyle;
  avatarSeed: string;
} {
  const style = isChatAgentAvatarStyle(wire.avatarStyle)
    ? wire.avatarStyle
    : 'lorelei';
  const seed =
    wire.avatarSeed.trim() || defaultAvatarSeedForAgent(wire.id, wire.name);
  return { avatarStyle: style, avatarSeed: seed };
}

function keysToMultiline(keys: readonly string[]): string {
  return keys.join('\n');
}

function authorNameForWire(
  wire: Pick<ChatAgentSummaryWire, 'kind'>,
  currentUserName?: string | null
): string {
  if (wire.kind === 'system') {
    return ALICE_SYSTEM_AUTHOR.name;
  }
  const name = currentUserName?.trim();
  return name || 'You';
}

export function chatAgentSummaryToRecord(
  wire: ChatAgentSummaryWire,
  options?: { readonly currentUserName?: string | null }
): ChatAgentRecord {
  const avatar = resolveAvatarFields(wire);
  return {
    id: wire.id,
    name: wire.name,
    title: wire.title,
    description: wire.description,
    instructions: '',
    kind: wire.kind,
    autonomy: wire.autonomy,
    status: wire.status === 'archived' ? 'archived' : 'active',
    version: wire.version,
    forkedFromId: wire.forkedFromId,
    tagline: wire.tagline,
    skills: keysToMultiline(wire.enabledSkillKeys),
    tools: keysToMultiline(wire.enabledToolKeys),
    enabledSkillKeys: wire.enabledSkillKeys,
    enabledToolKeys: wire.enabledToolKeys,
    avatarStyle: avatar.avatarStyle,
    avatarSeed: avatar.avatarSeed,
    isDefault: wire.isDefault,
    authorName: authorNameForWire(wire, options?.currentUserName),
  };
}

export function chatAgentDetailToRecord(
  wire: ChatAgentDetailWire,
  options?: { readonly currentUserName?: string | null }
): ChatAgentRecord {
  return {
    ...chatAgentSummaryToRecord(wire, options),
    instructions: wire.instructions,
  };
}

export function resolveChatAgentAvatarUrl(
  agent: Pick<ChatAgentRecord, 'avatarStyle' | 'avatarSeed'>,
  size?: number
): string {
  return buildDicebearAvatarUrl({
    style: agent.avatarStyle,
    seed: agent.avatarSeed,
    size,
  });
}

export function partitionGalleryAgents(agents: readonly ChatAgentRecord[]): {
  mine: ChatAgentRecord[];
  shared: ChatAgentRecord[];
  archived: ChatAgentRecord[];
} {
  const mine: ChatAgentRecord[] = [];
  const archived: ChatAgentRecord[] = [];
  for (const agent of agents) {
    if (agent.status === 'archived') {
      archived.push(agent);
      continue;
    }
    mine.push(agent);
  }
  return { mine, shared: [], archived };
}

export type ChatAgentDraftPatch = Partial<{
  name: string;
  title: string;
  description: string;
  instructions: string;
  autonomy: ChatAgentAutonomy;
  tagline: string;
  enabledSkillKeys: readonly string[];
  enabledToolKeys: readonly string[];
  status: ChatAgentStatus;
  avatarStyle: ChatAgentAvatarStyle;
  avatarSeed: string;
}>;

/** Build PATCH body from customize draft vs catalog key lists. */
export function draftToPatchBody(
  draft: ChatAgentDraftPatch,
  catalog: {
    readonly toolKeys: readonly string[];
    readonly skillKeys: readonly string[];
  }
): PatchChatAgentBody {
  const enabledToolKeys = new Set(draft.enabledToolKeys ?? []);
  const enabledSkillKeys = new Set(draft.enabledSkillKeys ?? []);

  const body: PatchChatAgentBody = {
    enabledTools: catalog.toolKeys.map((key) => ({
      key,
      enabled: enabledToolKeys.has(key),
    })),
    enabledSkills: catalog.skillKeys.map((key) => ({
      key,
      enabled: enabledSkillKeys.has(key),
    })),
  };

  if (draft.name !== undefined) {
    body.name = draft.name;
  }
  if (draft.title !== undefined) {
    body.title = draft.title;
  }
  if (draft.description !== undefined) {
    body.description = draft.description;
  }
  if (draft.instructions !== undefined) {
    body.instructions = draft.instructions;
  }
  if (draft.autonomy !== undefined) {
    body.autonomy = draft.autonomy;
  }
  if (draft.tagline !== undefined) {
    body.tagline = draft.tagline;
  }
  if (draft.status !== undefined) {
    body.status = draft.status;
  }
  if (draft.avatarStyle !== undefined) {
    body.avatarStyle = draft.avatarStyle;
  }
  if (draft.avatarSeed !== undefined) {
    body.avatarSeed = draft.avatarSeed;
  }

  return body;
}

export function resolvePreferredChatAgentId(
  visibleAgents: readonly Pick<ChatAgentRecord, 'id' | 'status'>[],
  preferredId: string | null = getPreferredChatAgentId()
): string | null {
  if (!preferredId) {
    return null;
  }
  const match = visibleAgents.find(
    (agent) => agent.id === preferredId && agent.status === 'active'
  );
  return match?.id ?? null;
}
