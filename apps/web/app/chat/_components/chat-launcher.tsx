'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Button } from '@repo/ui/components/ui/button';
import { Sparkles } from '@repo/ui/lib/icons';
import { FloatingChatDrawer } from './floating-chat-widget';
import type { AppRole } from '@/lib/rbac';
import { isWorkflowDesignerPath } from '@/app/chat/_helpers/chat-workflow-dock-path';
import { useChatBootstrap } from '@/app/chat/_helpers/use-chat-bootstrap';

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
  readonly currentUserRole?: AppRole | null;
};

export function ChatLauncherProvider({
  children,
  currentUserName,
  currentUserImageUrl,
  currentUserRole,
}: Readonly<ChatLauncherProviderProps>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hideForWorkflowDock = isWorkflowDesignerPath(pathname, (key) =>
    searchParams.get(key)
  );
  const [isOpen, setIsOpen] = useState(false);
  const {
    ensureLoaded,
    conversations,
    activeConversationId,
    messages,
    chatModels,
  } = useChatBootstrap({
    logLabel: 'bootstrap floating chat drawer',
  });

  const openLauncher = useCallback(async () => {
    await ensureLoaded();
    setIsOpen(true);
  }, [ensureLoaded]);

  const value = useMemo(() => ({ openLauncher }), [openLauncher]);

  const hideFloating = pathname === '/chat' || hideForWorkflowDock;

  return (
    <ChatLauncherContext.Provider value={value}>
      {children}
      {hideFloating ? null : (
        <FloatingChatDrawer
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          currentUserName={currentUserName}
          currentUserImageUrl={currentUserImageUrl}
          currentUserRole={currentUserRole}
          bootstrapConversations={conversations}
          bootstrapActiveConversationId={activeConversationId}
          bootstrapMessages={messages}
          bootstrapChatModels={chatModels ?? undefined}
        />
      )}
    </ChatLauncherContext.Provider>
  );
}

export function ChatLauncherButton() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { openLauncher } = useChatLauncher();
  const hideForWorkflowDock = isWorkflowDesignerPath(pathname, (key) =>
    searchParams.get(key)
  );

  if (pathname === '/chat' || hideForWorkflowDock) {
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
