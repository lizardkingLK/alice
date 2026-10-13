import type {
  ChatConversationSummaryWire,
  ChatMessageWire,
  ChatToolActionWire,
  ChatModelOption,
  ChatViewContext,
} from '@repo/types';
import type { AppRole } from '@/lib/rbac';

export type ActionItem = ChatToolActionWire;
export type ChatMessage = ChatMessageWire;
export type ChatConversation = ChatConversationSummaryWire;

export type ChatClientProps = {
  readonly variant?: 'page' | 'drawer' | 'docked';
  readonly onClose?: () => void;
  /** Page-aware context (e.g. workflow designer draft) sent with each turn. */
  readonly viewContext?: ChatViewContext | null;
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
