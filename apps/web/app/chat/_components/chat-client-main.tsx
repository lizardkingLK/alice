'use client';

import { Loader2 } from '@repo/ui/lib/icons';
import { ScrollArea } from '@repo/ui/components/ui/scroll-area';
import type { ChatMessage } from './chat-client.types';
import ChatHeroSection from '@/app/chat/_components/chat-client-hero';
import ChatClientThread from '@/app/chat/_components/chat-client-thread';

type ChatClientMainProps = {
  readonly isPage: boolean;
  readonly isLoadingHistory: boolean;
  readonly showHero: boolean;
  readonly showEmptyThread: boolean;
  readonly messages: ChatMessage[];
  readonly isPending: boolean;
  readonly error: string | null;
  readonly currentUserName?: string | null;
  readonly currentUserImageUrl?: string | null;
  readonly messagesEndRef: React.RefObject<HTMLDivElement | null>;
  // eslint-disable-next-line no-unused-vars
  readonly onSendMessage: (text: string) => void;
};

export default function ChatClientMain({
  isPage,
  isLoadingHistory,
  showHero,
  showEmptyThread,
  messages,
  isPending,
  error,
  currentUserName,
  currentUserImageUrl,
  messagesEndRef,
  onSendMessage,
}: Readonly<ChatClientMainProps>) {
  if (isLoadingHistory) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2">
        <Loader2 className="text-primary size-8 animate-spin" />
        <span className="text-muted-foreground text-sm">
          Loading chat history...
        </span>
      </div>
    );
  }

  if (showHero) {
    return (
      <ChatHeroSection isPage={isPage} handleSendMessage={onSendMessage} />
    );
  }

  return (
    <ScrollArea className="min-h-0 flex-1">
      <ChatClientThread
        isPage={isPage}
        showEmptyThread={showEmptyThread}
        messages={messages}
        isPending={isPending}
        error={error}
        currentUserName={currentUserName}
        currentUserImageUrl={currentUserImageUrl}
        messagesEndRef={messagesEndRef}
      />
    </ScrollArea>
  );
}
