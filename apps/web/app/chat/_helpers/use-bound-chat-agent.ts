'use client';

import { useEffect, useState } from 'react';
import {
  chatAgentSummaryToRecord,
  type ChatAgentKind,
  type ChatAgentRecord,
} from '@/app/chat/_helpers/chat-agents-catalog';
import type { ChatAgentAvatarStyle } from '@/app/chat/_helpers/chat-agent-avatar';
import { listChatAgentsClient } from '@/app/chat/_services/chat-agents.reads.client';

/** Default product assistant when no agent is bound to the conversation. */
export const DEFAULT_CHAT_ASSISTANT_NAME = 'Alice';

export type ChatAssistantIdentity = {
  readonly id: string;
  readonly name: string;
  readonly title: string;
  readonly kind: ChatAgentKind;
  readonly avatarStyle: ChatAgentAvatarStyle;
  readonly avatarSeed: string;
};

function toIdentity(agent: ChatAgentRecord): ChatAssistantIdentity {
  return {
    id: agent.id,
    name: agent.name,
    title: agent.title,
    kind: agent.kind,
    avatarStyle: agent.avatarStyle,
    avatarSeed: agent.avatarSeed,
  };
}

/** Resolve a bound agent from the API catalog (null = Alice fallback). */
export function useBoundChatAgent(
  agentId: string | undefined
): ChatAssistantIdentity | null {
  const [identity, setIdentity] = useState<ChatAssistantIdentity | null>(null);

  useEffect(() => {
    if (!agentId) {
      setIdentity(null);
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const agents = await listChatAgentsClient();
        if (cancelled) {
          return;
        }
        const found = agents.find((agent) => agent.id === agentId);
        setIdentity(found ? toIdentity(chatAgentSummaryToRecord(found)) : null);
      } catch (error) {
        console.error('Failed to resolve bound chat agent:', error);
        if (!cancelled) {
          setIdentity(null);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  return identity;
}
