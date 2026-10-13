'use client';

import { Sparkles } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import type { ChatModelOption } from '@repo/types';
import type { ChatViewContext } from '@repo/types/api/v1';
import type { AppRole } from '@/lib/rbac';
import { ChatClient } from './chat-client';
import type { ChatConversation, ChatMessage } from './chat-client.types';

type DockedChatPanelProps = {
  readonly onClose: () => void;
  readonly viewContext: ChatViewContext | null;
  readonly currentUserName?: string | null;
  readonly currentUserImageUrl?: string | null;
  readonly currentUserRole?: AppRole | null;
  readonly bootstrapConversations: ChatConversation[] | null;
  readonly bootstrapActiveConversationId?: string;
  readonly bootstrapMessages: ChatMessage[] | null;
  readonly bootstrapChatModels: ChatModelOption[] | null;
};

/**
 * App-shell Alice sidebar: same chrome as the old drawer, but a real flex
 * sibling (no overlay, no backdrop blur, full available height).
 */
export function DockedChatPanel({
  onClose,
  viewContext,
  currentUserName,
  currentUserImageUrl,
  currentUserRole,
  bootstrapConversations,
  bootstrapActiveConversationId,
  bootstrapMessages,
  bootstrapChatModels,
}: Readonly<DockedChatPanelProps>) {
  return (
    <aside
      className={cn(
        'border-border bg-background flex h-full min-h-0 w-full max-w-md shrink-0 flex-col border-l sm:w-110'
      )}
      data-testid="alice-dock"
    >
      {bootstrapConversations === null || bootstrapChatModels === null ? (
        <div className="text-muted-foreground flex h-full min-h-0 flex-1 items-center justify-center gap-2 p-4 text-sm">
          <Sparkles className="size-4" />
          Loading Alice…
        </div>
      ) : (
        <ChatClient
          variant="docked"
          onClose={onClose}
          viewContext={viewContext}
          currentUserName={currentUserName}
          currentUserImageUrl={currentUserImageUrl}
          currentUserRole={currentUserRole}
          initialConversations={bootstrapConversations}
          initialConversationId={bootstrapActiveConversationId}
          initialMessages={bootstrapMessages ?? undefined}
          initialChatModels={bootstrapChatModels}
        />
      )}
    </aside>
  );
}
