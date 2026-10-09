'use client';

import { Button } from '@repo/ui/components/ui/button';
import { Sparkles } from '@repo/ui/lib/icons';
import type { ChatViewContext } from '@repo/types/api/v1';
import type { AppRole } from '@/lib/rbac';
import { ChatClient } from './chat-client';
import { useChatBootstrap } from '@/app/chat/_helpers/use-chat-bootstrap';

type DockedChatPanelProps = {
  readonly open: boolean;
  readonly onOpenChange: (
    // eslint-disable-next-line no-unused-vars -- documents callback payload
    open: boolean
  ) => void;
  readonly viewContext: ChatViewContext | null;
  readonly currentUserName?: string | null;
  readonly currentUserImageUrl?: string | null;
  readonly currentUserRole?: AppRole | null;
};

/**
 * Width-sharing Alice sidebar for the workflow designer (no overlay backdrop).
 */
export function DockedChatPanel({
  open,
  onOpenChange,
  viewContext,
  currentUserName,
  currentUserImageUrl,
  currentUserRole,
}: Readonly<DockedChatPanelProps>) {
  const bootstrap = useChatBootstrap({
    enabled: open,
    logLabel: 'bootstrap docked chat',
  });

  if (!open) {
    return (
      <div className="border-border flex shrink-0 flex-col items-center border-l py-3">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Open Alice"
          onClick={() => onOpenChange(true)}
        >
          <Sparkles className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <aside
      className="border-border bg-background flex h-[min(720px,calc(100dvh-12rem))] w-full max-w-md min-w-80 shrink-0 flex-col border-l sm:w-96"
      data-testid="workflow-alice-dock"
    >
      {bootstrap.conversations === null || bootstrap.chatModels === null ? (
        <div className="text-muted-foreground flex h-full items-center justify-center gap-2 p-4 text-sm">
          <Sparkles className="size-4" />
          Loading Alice…
        </div>
      ) : (
        <ChatClient
          variant="docked"
          onClose={() => onOpenChange(false)}
          viewContext={viewContext}
          currentUserName={currentUserName}
          currentUserImageUrl={currentUserImageUrl}
          currentUserRole={currentUserRole}
          initialConversations={bootstrap.conversations}
          initialConversationId={bootstrap.activeConversationId}
          initialMessages={bootstrap.messages ?? undefined}
          initialChatModels={bootstrap.chatModels}
        />
      )}
    </aside>
  );
}
