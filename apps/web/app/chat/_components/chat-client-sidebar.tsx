'use client';

import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { ScrollArea } from '@repo/ui/components/ui/scroll-area';
import { Loader2, Trash2 } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import type { ChatConversation } from '../_services/chat-client.service';

type ChatClientSidebarProps = {
  readonly showHistory: boolean;
  readonly conversationSearch: string;
  // eslint-disable-next-line no-unused-vars
  readonly onConversationSearchChange: (value: string) => void;
  readonly isLoadingConversations: boolean;
  readonly conversations: ChatConversation[];
  readonly activeConversationId?: string;
  // eslint-disable-next-line no-unused-vars
  readonly onSelectConversation: (id: string) => void;
  readonly onNewChat: () => void;
  readonly onDeleteConversationClick: (
    // eslint-disable-next-line no-unused-vars
    e: React.MouseEvent,
    // eslint-disable-next-line no-unused-vars
    conv: ChatConversation
  ) => void;
};

function ConversationButton({
  title,
  isActive,
  isProcessing,
  onClick,
}: Readonly<{
  title: string;
  isActive: boolean;
  isProcessing?: boolean;
  onClick: () => void;
}>) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      disabled={isProcessing}
      className={cn(
        'h-auto w-full justify-start px-3 py-2.5 pr-10 text-left text-xs font-normal gap-2 flex items-center',
        isActive
          ? 'bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary font-medium'
          : 'text-muted-foreground'
      )}
    >
      {isProcessing && (
        <Loader2 className="size-3.5 animate-spin shrink-0 text-primary" />
      )}
      <span className="block w-full truncate" title={title}>
        {title}
      </span>
    </Button>
  );
}

export default function ChatClientSidebar({
  showHistory,
  conversationSearch,
  onConversationSearchChange,
  isLoadingConversations,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversationClick,
}: Readonly<ChatClientSidebarProps>) {
  const renderSidebarContent = () => {
    if (isLoadingConversations) {
      return (
        <div className="flex justify-center p-4">
          <Loader2 className="text-muted-foreground size-4 animate-spin" />
        </div>
      );
    }

    if (conversations.length === 0) {
      return (
        <div className="space-y-0.5">
          <ConversationButton
            title="New Chat"
            isActive={!activeConversationId}
            onClick={onNewChat}
          />
        </div>
      );
    }

    const filteredConversations = conversations.filter((conv) => {
      const q = conversationSearch.trim().toLowerCase();
      if (!q) return true;
      return conv.title.toLowerCase().includes(q);
    });

    if (filteredConversations.length === 0) {
      return (
        <p className="text-muted-foreground p-4 text-center text-xs">
          No chats match &quot;{conversationSearch.trim()}&quot;
        </p>
      );
    }

    return filteredConversations.map((conv) => {
      const isActive = conv.id === activeConversationId;
      return (
        <div
          key={conv.id}
          className="group relative flex items-center overflow-hidden rounded-lg"
        >
          <ConversationButton
            title={conv.title}
            isActive={isActive}
            isProcessing={conv.is_processing}
            onClick={() => onSelectConversation(conv.id)}
          />
          {!conv.is_processing && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={(e) => onDeleteConversationClick(e, conv)}
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 absolute right-1.5 z-10 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              aria-label={`Delete chat session ${conv.title}`}
            >
              <Trash2 />
            </Button>
          )}
        </div>
      );
    });
  };

  return (
    <aside
      id="chat-history-sidebar"
      className={cn(
        'border-border bg-muted/20 flex shrink-0 flex-col border-r transition-[width] duration-200 ease-out',
        showHistory ? 'w-64' : 'w-0 overflow-hidden border-r-0'
      )}
      aria-hidden={!showHistory}
    >
      {showHistory ? (
        <>
          <div className="border-border flex h-14 shrink-0 items-center border-b px-3">
            <Input
              value={conversationSearch}
              onChange={(e) => onConversationSearchChange(e.target.value)}
              placeholder="Search chats..."
              aria-label="Search chat conversations"
              className="bg-background/50 border-border/80 h-9 text-xs"
            />
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-0.5 p-2">{renderSidebarContent()}</div>
          </ScrollArea>
        </>
      ) : null}
    </aside>
  );
}
