import type { ChatPageTab } from '@/lib/search-params';

export type ChatConversationUrlInput = {
  readonly conversationId?: string | null;
  readonly agentId?: string | null;
};

export type BuildChatHrefInput = ChatConversationUrlInput & {
  readonly tab?: ChatPageTab;
};

/** Build `/chat` href with conversation / agents query params. */
export function buildChatHref({
  tab = 'conversation',
  conversationId,
  agentId,
}: BuildChatHrefInput = {}): string {
  const params = new URLSearchParams();
  if (tab === 'agents') {
    params.set('tab', 'agents');
  }
  if (conversationId) {
    params.set('conversationId', conversationId);
  }
  if (agentId) {
    params.set('agentId', agentId);
  }
  const query = params.toString();
  return query ? `/chat?${query}` : '/chat';
}

export function buildChatAgentsGalleryHref(): string {
  return buildChatHref({ tab: 'agents' });
}

export function buildChatAgentCustomizeHref(agentId: string): string {
  return `/chat/agents/${encodeURIComponent(agentId)}`;
}

export function buildChatWithAgentHref(
  agentId: string,
  conversationId?: string | null
): string {
  return buildChatHref({
    tab: 'conversation',
    agentId,
    conversationId,
  });
}
