import type {
  ChatConversationSummaryWire,
  ChatMessageWire,
  ChatToolActionWire,
  ChatModelOption,
  ChatViewContext,
} from '@repo/types';
import type { AppRole } from '@/lib/rbac';
import type { ChatDockPageContext } from '@/app/chat/_components/chat-dock-context-bar';

export type ActionItem = ChatToolActionWire;
export type ChatMessage = ChatMessageWire;
export type ChatConversation = ChatConversationSummaryWire;

export type ChatClientVariant = 'page' | 'drawer' | 'docked' | 'widget';

/** Docked shell + Overview widget share compact chrome (composer / header). */
export function isCompactChatChrome(variant: ChatClientVariant): boolean {
  return variant === 'docked' || variant === 'widget';
}

export type ChatClientProps = {
  /** Remounts conversation-scoped state without resetting model selection. */
  readonly conversationStateKey?: string;
  readonly variant?: ChatClientVariant;
  readonly onClose?: () => void;
  /** Page-aware context (e.g. workflow designer draft) sent with each turn. */
  readonly viewContext?: ChatViewContext | null;
  /** Dock-only: page Alice was opened from (shown above the composer). */
  readonly pageContext?: ChatDockPageContext | null;
  readonly onDismissPageContext?: () => void;
  readonly currentUserName?: string | null;
  readonly currentUserEmail?: string | null;
  readonly currentUserImageUrl?: string | null;
  /** SSR bootstrap for `/chat` — skips the mount fetch when provided. */
  readonly initialConversations?: ChatConversation[];
  readonly initialConversationId?: string;
  readonly initialMessages?: ChatMessage[];
  readonly initialChatModels?: ChatModelOption[];
  /** Bound agent from `/chat?agentId=` (page variant). */
  readonly initialAgentId?: string;
  /** SSR cookie preference for the conversation history sidebar. */
  readonly initialHistoryOpen?: boolean;
  readonly currentUserId?: string | null;
  readonly currentUserRole?: AppRole | null;
};
