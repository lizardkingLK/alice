/**
 * Serializable assistant identity for SSR → client (no hooks).
 */

import type {
  ChatAgentDetailWire,
  ChatAgentSummaryWire,
} from '@repo/types/api/v1';
import {
  defaultAvatarSeedForAgent,
  isChatAgentAvatarStyle,
  type ChatAgentAvatarStyle,
} from '@/app/chat/_helpers/chat-agent-avatar';
import type { ChatAgentKind } from '@/app/chat/_helpers/chat-agents-catalog';

export const DEFAULT_CHAT_ASSISTANT_NAME = 'Alice';

export type ChatAssistantIdentity = {
  readonly id: string;
  readonly name: string;
  readonly title: string;
  readonly kind: ChatAgentKind;
  readonly avatarStyle: ChatAgentAvatarStyle;
  readonly avatarSeed: string;
};

/** SSR seed for Overview Alice / chat surfaces. */
export type PreferredChatAssistantBootstrap = {
  readonly agentId: string;
  readonly identity: ChatAssistantIdentity;
};

/** Stable empty roster — avoid `= []` defaults that remount-wipe client loads. */
export const EMPTY_PREFERRED_CHAT_AGENTS: readonly PreferredChatAssistantBootstrap[] =
  [];

function resolveAvatar(
  wire: Pick<ChatAgentSummaryWire, 'id' | 'name' | 'avatarStyle' | 'avatarSeed'>
): {
  readonly avatarStyle: ChatAgentAvatarStyle;
  readonly avatarSeed: string;
} {
  const style = isChatAgentAvatarStyle(wire.avatarStyle)
    ? wire.avatarStyle
    : 'lorelei';
  const seed =
    wire.avatarSeed.trim() || defaultAvatarSeedForAgent(wire.id, wire.name);
  return { avatarStyle: style, avatarSeed: seed };
}

export function chatAssistantIdentityFromWire(
  wire: ChatAgentSummaryWire | ChatAgentDetailWire
): ChatAssistantIdentity {
  const avatar = resolveAvatar(wire);
  return {
    id: wire.id,
    name: wire.name,
    title: wire.title,
    kind: wire.kind === 'personal' ? 'personal' : 'system',
    avatarStyle: avatar.avatarStyle,
    avatarSeed: avatar.avatarSeed,
  };
}

export function preferredChatAssistantFromWire(
  wire: ChatAgentSummaryWire | ChatAgentDetailWire
): PreferredChatAssistantBootstrap {
  return {
    agentId: wire.id,
    identity: chatAssistantIdentityFromWire(wire),
  };
}

/** Cycle Overview Alice personality chevrons across SSR-seeded agents. */
export function shiftPreferredChatAssistant(
  agents: readonly PreferredChatAssistantBootstrap[],
  currentAgentId: string | null | undefined,
  direction: -1 | 1
): PreferredChatAssistantBootstrap | null {
  if (agents.length === 0) {
    return null;
  }
  const index = agents.findIndex((agent) => agent.agentId === currentAgentId);
  const safeIndex = index < 0 ? 0 : index;
  const next = (safeIndex + direction + agents.length) % agents.length;
  return agents[next] ?? null;
}
