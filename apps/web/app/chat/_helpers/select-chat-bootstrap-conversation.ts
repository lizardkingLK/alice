import type { ChatConversation } from '../_components/chat-client.types';

export type ChatBootstrapSelection =
  | { kind: 'empty' }
  | { kind: 'not_found' }
  | { kind: 'selected'; conversation: ChatConversation };

/**
 * Resolve which conversation `/chat` should open for an optional
 * `conversationId` query. A missing id opens the latest thread; an unknown id
 * is not found (favorites / deep links) — never silently fall back.
 */
export function selectChatBootstrapConversation(
  conversations: readonly ChatConversation[],
  activeId?: string
): ChatBootstrapSelection {
  if (activeId) {
    const match = conversations.find(
      (conversation) => conversation.id === activeId
    );
    return match
      ? { kind: 'selected', conversation: match }
      : { kind: 'not_found' };
  }

  const latest = conversations[0];
  return latest
    ? { kind: 'selected', conversation: latest }
    : { kind: 'empty' };
}
