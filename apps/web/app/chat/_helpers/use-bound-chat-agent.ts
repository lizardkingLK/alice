'use client';

import { useEffect, useState } from 'react';
import {
  chatAssistantIdentityFromWire,
  type ChatAssistantIdentity,
} from '@/app/chat/_helpers/chat-assistant-identity';
import {
  getPreferredChatAgentId,
  setPreferredChatAgentId,
} from '@/app/chat/_helpers/preferred-chat-agent-storage';
import { getChatAgentClient } from '@/app/chat/_services/chat-agents.reads.client';
import { ApiError } from '@/lib/api/api-fetch.helper';

export {
  DEFAULT_CHAT_ASSISTANT_NAME,
  type ChatAssistantIdentity,
} from '@/app/chat/_helpers/chat-assistant-identity';

export type UseBoundChatAgentOptions = {
  /** SSR / parent seed — skips the empty flash before the client fetch. */
  readonly initialIdentity?: ChatAssistantIdentity | null;
};

/** Resolve a bound agent from GET /chat-agents/:id (null = Alice fallback). */
export function useBoundChatAgent(
  agentId: string | undefined,
  options?: UseBoundChatAgentOptions
): ChatAssistantIdentity | null {
  const initialIdentity = options?.initialIdentity ?? null;
  const [identity, setIdentity] = useState<ChatAssistantIdentity | null>(() => {
    if (!agentId) {
      return null;
    }
    if (initialIdentity?.id === agentId) {
      return initialIdentity;
    }
    return null;
  });

  const seedId = initialIdentity?.id;
  const seedMatches = Boolean(agentId && seedId && seedId === agentId);

  useEffect(() => {
    if (!agentId) {
      setIdentity(null);
      return;
    }

    if (seedMatches && initialIdentity) {
      setIdentity(initialIdentity);
    }

    let cancelled = false;
    const load = async () => {
      try {
        const detail = await getChatAgentClient(agentId);
        if (cancelled) {
          return;
        }
        setIdentity(chatAssistantIdentityFromWire(detail));
      } catch (error) {
        const notFound =
          error instanceof ApiError &&
          (error.status === 404 ||
            error.message.toLowerCase().includes('not found'));
        if (notFound && getPreferredChatAgentId() === agentId) {
          setPreferredChatAgentId(null);
        }
        if (!notFound) {
          console.error('Failed to resolve bound chat agent:', error);
        }
        if (!cancelled && !(seedMatches && initialIdentity)) {
          setIdentity(null);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [agentId, initialIdentity, seedMatches]);

  return identity;
}
