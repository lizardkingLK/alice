import { cache } from 'react';
import { cookies } from 'next/headers';
import { apiFetch } from '@/lib/api/api-fetch.reads.use.server';
import {
  preferredChatAssistantFromWire,
  type PreferredChatAssistantBootstrap,
} from '@/app/chat/_helpers/chat-assistant-identity';
import {
  parsePreferredChatAgentCookie,
  PREFERRED_CHAT_AGENT_COOKIE_NAME,
} from '@/app/chat/_helpers/preferred-chat-agent-storage';
import { createChatAgentsService } from '@/app/chat/_services/chat-agents-api.shared';

const service = createChatAgentsService(apiFetch);

export const listChatAgentsForChat = cache(() => service.listChatAgents());

export const getChatAgentForChat = cache((id: string) =>
  service.getChatAgent(id)
);

export type { PreferredChatAssistantBootstrap };

export type OverviewChatAgentsBootstrap = {
  readonly agents: readonly PreferredChatAssistantBootstrap[];
  readonly preferredAgentId: string | null;
};

/**
 * Active agents for Overview Alice chevrons + preferred/default selection.
 */
export const resolveOverviewChatAgentsBootstrap = cache(
  async (): Promise<OverviewChatAgentsBootstrap> => {
    const store = await cookies();
    const preferredId = parsePreferredChatAgentCookie(
      store.get(PREFERRED_CHAT_AGENT_COOKIE_NAME)?.value
    );

    try {
      const rows = await listChatAgentsForChat();
      const agents = rows
        .filter((agent) => agent.status === 'active')
        .map((agent) => preferredChatAssistantFromWire(agent));

      if (agents.length === 0) {
        return { agents: [], preferredAgentId: null };
      }

      const preferredAgentId =
        (preferredId &&
          agents.find((agent) => agent.agentId === preferredId)?.agentId) ||
        rows.find((agent) => agent.status === 'active' && agent.isDefault)
          ?.id ||
        agents[0]?.agentId ||
        null;

      return { agents, preferredAgentId };
    } catch {
      return { agents: [], preferredAgentId: null };
    }
  }
);

/**
 * Preferred agent cookie, else workspace default, else first active agent.
 * @deprecated Prefer `resolveOverviewChatAgentsBootstrap` for Overview.
 */
export const resolvePreferredChatAssistantBootstrap = cache(
  async (): Promise<PreferredChatAssistantBootstrap | null> => {
    const { agents, preferredAgentId } =
      await resolveOverviewChatAgentsBootstrap();
    if (!preferredAgentId) {
      return null;
    }
    return agents.find((agent) => agent.agentId === preferredAgentId) ?? null;
  }
);
