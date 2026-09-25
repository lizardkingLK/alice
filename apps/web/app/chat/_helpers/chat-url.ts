export type ChatConversationUrlInput = {
  readonly conversationId?: string | null;
  readonly agentId?: string | null;
};

/** Build `/chat` href with conversation / bound-agent query params. */
export function buildChatHref({
  conversationId,
  agentId,
}: ChatConversationUrlInput = {}): string {
  const params = new URLSearchParams();
  if (conversationId) {
    params.set('conversationId', conversationId);
  }
  if (agentId) {
    params.set('agentId', agentId);
  }
  const query = params.toString();
  return query ? `/chat?${query}` : '/chat';
}

/** Agents gallery lives in the chat header panel (no separate route). */
export function buildChatAgentsGalleryHref(): string {
  return '/chat';
}

export function buildChatWithAgentHref(
  agentId: string,
  conversationId?: string | null
): string {
  return buildChatHref({
    agentId,
    conversationId,
  });
}
