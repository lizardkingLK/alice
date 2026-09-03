'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import { Button } from '@repo/ui/components/ui/button';
import { Sparkles } from '@repo/ui/lib/icons';
import type { ChatConversation, ChatMessage } from './chat-client.types';
import type { ChatModelOption } from '@repo/types';
import { bootstrapLatestChat } from './chat-client-bootstrap';
import { FloatingChatDrawer } from './floating-chat-widget';

type ChatLauncherContextValue = {
  openLauncher: () => Promise<void>;
};

const ChatLauncherContext = createContext<ChatLauncherContextValue | null>(
  null
);

export function useChatLauncher(): ChatLauncherContextValue {
  const context = useContext(ChatLauncherContext);
  if (!context) {
    throw new Error('useChatLauncher must be used within ChatLauncherProvider');
  }
  return context;
}

type ChatLauncherProviderProps = {
  readonly children: ReactNode;
  readonly currentUserName?: string | null;
  readonly currentUserImageUrl?: string | null;
};

export function ChatLauncherProvider({
  children,
  currentUserName,
  currentUserImageUrl,
}: Readonly<ChatLauncherProviderProps>) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isBootstrapLoading, setIsBootstrapLoading] = useState(false);
  const [bootstrapConversations, setBootstrapConversations] = useState<
    ChatConversation[] | null
  >(null);
  const [bootstrapActiveConversationId, setBootstrapActiveConversationId] =
    useState<string | undefined>(undefined);
  const [bootstrapMessages, setBootstrapMessages] = useState<
    ChatMessage[] | null
  >(null);
  const [bootstrapChatModels, setBootstrapChatModels] = useState<
    ChatModelOption[] | null
  >(null);

  const ensureBootstrapLoaded = useCallback(async () => {
    if (bootstrapConversations && bootstrapChatModels) return;
    if (isBootstrapLoading) return;

    setIsBootstrapLoading(true);
    try {
      const bootstrap = await bootstrapLatestChat();
      setBootstrapConversations(bootstrap.conversations);
      setBootstrapActiveConversationId(bootstrap.activeConversationId);
      setBootstrapMessages(bootstrap.messages);
      setBootstrapChatModels(bootstrap.chatModels);
    } catch (err) {
      console.error('Failed to bootstrap floating chat drawer:', err);
      setBootstrapConversations([]);
      setBootstrapActiveConversationId(undefined);
      setBootstrapMessages([]);
      setBootstrapChatModels([]);
    } finally {
      setIsBootstrapLoading(false);
    }
  }, [bootstrapChatModels, bootstrapConversations, isBootstrapLoading]);

  const openLauncher = useCallback(async () => {
    await ensureBootstrapLoaded();
    setIsOpen(true);
  }, [ensureBootstrapLoaded]);

  const value = useMemo(() => ({ openLauncher }), [openLauncher]);

  const hideOnChatPage = pathname === '/chat';

  return (
    <ChatLauncherContext.Provider value={value}>
      {children}
      {hideOnChatPage ? null : (
        <FloatingChatDrawer
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          currentUserName={currentUserName}
          currentUserImageUrl={currentUserImageUrl}
          bootstrapConversations={bootstrapConversations}
          bootstrapActiveConversationId={bootstrapActiveConversationId}
          bootstrapMessages={bootstrapMessages}
          bootstrapChatModels={bootstrapChatModels ?? undefined}
        />
      )}
    </ChatLauncherContext.Provider>
  );
}

export function ChatLauncherButton() {
  const pathname = usePathname();
  const { openLauncher } = useChatLauncher();

  if (pathname === '/chat') {
    return null;
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label="Open Alice"
      className="cursor-pointer"
      onClick={() => {
        void openLauncher();
      }}
    >
      <Sparkles className="size-4" />
    </Button>
  );
}
