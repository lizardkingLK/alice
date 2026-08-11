'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Button } from '@repo/ui/components/ui/button';
import { Sparkles } from '@repo/ui/lib/icons';
import { ChatClient } from './chat-client';
import type { ChatConversation, ChatMessage } from './chat-client.types';
import { bootstrapLatestChat } from './chat-client-bootstrap';

type FloatingChatWidgetProps = {
  readonly currentUserName?: string | null;
  readonly currentUserImageUrl?: string | null;
};

export function FloatingChatWidget({
  currentUserName,
  currentUserImageUrl,
}: Readonly<FloatingChatWidgetProps>) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isBootstrapLoading, setIsBootstrapLoading] = useState(false);

  // Cache bootstrap data across open/close so the drawer reopens instantly.
  const [bootstrapConversations, setBootstrapConversations] = useState<
    ChatConversation[] | null
  >(null);
  const [bootstrapActiveConversationId, setBootstrapActiveConversationId] =
    useState<string | undefined>(undefined);
  const [bootstrapMessages, setBootstrapMessages] = useState<
    ChatMessage[] | null
  >(null);

  if (pathname === '/chat') {
    return null;
  }

  async function ensureBootstrapLoaded() {
    if (bootstrapConversations) return;
    if (isBootstrapLoading) return;

    setIsBootstrapLoading(true);
    try {
      const bootstrap = await bootstrapLatestChat();
      setBootstrapConversations(bootstrap.conversations);
      setBootstrapActiveConversationId(bootstrap.activeConversationId);
      setBootstrapMessages(bootstrap.messages);
    } catch (err) {
      // Best-effort: drawer should still open even if history fails.
      console.error('Failed to bootstrap floating chat drawer:', err);
      setBootstrapConversations([]);
      setBootstrapActiveConversationId(undefined);
      setBootstrapMessages([]);
    } finally {
      setIsBootstrapLoading(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        size="icon-lg"
        onClick={async () => {
          await ensureBootstrapLoaded();
          setIsOpen(true);
        }}
        className="fixed right-6 bottom-6 z-40 size-14 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95"
        aria-label="Open Alice"
      >
        <Sparkles className="size-6 animate-pulse" />
      </Button>

      {isOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default border-none bg-black/45 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setIsOpen(false)}
            aria-label="Close Chat"
          />

          <div className="bg-background border-border animate-in slide-in-from-right fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l shadow-2xl transition-all duration-300 sm:w-110">
            <ChatClient
              variant="drawer"
              onClose={() => setIsOpen(false)}
              currentUserName={currentUserName}
              currentUserImageUrl={currentUserImageUrl}
              initialConversations={bootstrapConversations ?? undefined}
              initialConversationId={bootstrapActiveConversationId}
              initialMessages={bootstrapMessages ?? undefined}
            />
          </div>
        </>
      ) : null}
    </>
  );
}
