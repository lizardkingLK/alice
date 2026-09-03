'use client';

import { ChatClient } from './chat-client';
import type { ChatConversation, ChatMessage } from './chat-client.types';
import type { ChatModelOption } from '@repo/types';

type FloatingChatDrawerProps = {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly currentUserName?: string | null;
  readonly currentUserImageUrl?: string | null;
  readonly bootstrapConversations: ChatConversation[] | null;
  readonly bootstrapActiveConversationId?: string;
  readonly bootstrapMessages: ChatMessage[] | null;
  readonly bootstrapChatModels?: ChatModelOption[];
};

export function FloatingChatDrawer({
  isOpen,
  onClose,
  currentUserName,
  currentUserImageUrl,
  bootstrapConversations,
  bootstrapActiveConversationId,
  bootstrapMessages,
  bootstrapChatModels,
}: Readonly<FloatingChatDrawerProps>) {
  if (!isOpen) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 cursor-default border-none bg-black/45 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
        aria-label="Close Chat"
      />

      <div className="bg-background border-border animate-in slide-in-from-right fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l shadow-2xl transition-all duration-300 sm:w-110">
        <ChatClient
          variant="drawer"
          onClose={onClose}
          currentUserName={currentUserName}
          currentUserImageUrl={currentUserImageUrl}
          initialConversations={bootstrapConversations ?? undefined}
          initialConversationId={bootstrapActiveConversationId}
          initialMessages={bootstrapMessages ?? undefined}
          initialChatModels={bootstrapChatModels}
        />
      </div>
    </>
  );
}
