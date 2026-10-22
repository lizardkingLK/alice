'use client';

import { cn } from '@repo/ui/lib/utils';
import type { ChatViewContext } from '@repo/types/api/v1';
import type { AppRole } from '@/lib/rbac';
import type { ChatDockPageContext } from '@/app/chat/_components/chat-dock-context-bar';
import { ChatClient } from './chat-client';

type DockedChatPanelProps = {
  readonly onClose: () => void;
  readonly viewContext: ChatViewContext | null;
  readonly pageContext: ChatDockPageContext | null;
  readonly onDismissPageContext?: () => void;
  readonly currentUserName?: string | null;
  readonly currentUserImageUrl?: string | null;
  readonly currentUserRole?: AppRole | null;
};

/**
 * App-shell Alice sidebar: opens instantly with empty session state.
 * Conversations are temporary (not listed on `/chat`); models load on demand.
 */
export function DockedChatPanel({
  onClose,
  viewContext,
  pageContext,
  onDismissPageContext,
  currentUserName,
  currentUserImageUrl,
  currentUserRole,
}: Readonly<DockedChatPanelProps>) {
  return (
    <aside
      className={cn(
        'border-border bg-background flex h-full min-h-0 w-full max-w-md shrink-0 flex-col border-l sm:w-110'
      )}
      data-testid="alice-dock"
    >
      <ChatClient
        variant="docked"
        onClose={onClose}
        viewContext={viewContext}
        pageContext={pageContext}
        onDismissPageContext={onDismissPageContext}
        currentUserName={currentUserName}
        currentUserImageUrl={currentUserImageUrl}
        currentUserRole={currentUserRole}
        initialConversations={[]}
        initialMessages={[]}
      />
    </aside>
  );
}
