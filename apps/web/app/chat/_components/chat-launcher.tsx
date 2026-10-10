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
import type { ChatViewContext } from '@repo/types/api/v1';
import type { AppRole } from '@/lib/rbac';
import { useChatBootstrap } from '@/app/chat/_helpers/use-chat-bootstrap';
import { DockedChatPanel } from '@/app/chat/_components/docked-chat-panel';
import type { WorkflowAliceBridgeValue } from '@/app/projects/_components/project-details/workflow-alice-bridge';

type ChatLauncherContextValue = {
  readonly isOpen: boolean;
  readonly openLauncher: () => Promise<void>;
  readonly closeLauncher: () => void;
  readonly toggleLauncher: () => Promise<void>;
  readonly viewContext: ChatViewContext | null;
  readonly setViewContext: (
    // eslint-disable-next-line no-unused-vars -- documents payload
    context: ChatViewContext | null
  ) => void;
  readonly surfaceBridge: WorkflowAliceBridgeValue | null;
  readonly setSurfaceBridge: (
    // eslint-disable-next-line no-unused-vars -- documents payload
    bridge: WorkflowAliceBridgeValue | null
  ) => void;
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

/** Null-safe read for surfaces that may render outside the launcher. */
export function useChatLauncherOptional(): ChatLauncherContextValue | null {
  return useContext(ChatLauncherContext);
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
  const hideOnChatPage = pathname === '/chat';
  const [isOpen, setIsOpen] = useState(false);
  const [viewContext, setViewContext] = useState<ChatViewContext | null>(null);
  const [surfaceBridge, setSurfaceBridge] =
    useState<WorkflowAliceBridgeValue | null>(null);

  const {
    ensureLoaded,
    conversations,
    activeConversationId,
    messages,
    chatModels,
  } = useChatBootstrap({
    enabled: isOpen && !hideOnChatPage,
    logLabel: 'bootstrap docked Alice sidebar',
  });

  const openLauncher = useCallback(async () => {
    await ensureLoaded();
    setIsOpen(true);
  }, [ensureLoaded]);

  const closeLauncher = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleLauncher = useCallback(async () => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    await ensureLoaded();
    setIsOpen(true);
  }, [ensureLoaded, isOpen]);

  const value = useMemo(
    () => ({
      isOpen,
      openLauncher,
      closeLauncher,
      toggleLauncher,
      viewContext,
      setViewContext,
      surfaceBridge,
      setSurfaceBridge,
    }),
    [
      isOpen,
      openLauncher,
      closeLauncher,
      toggleLauncher,
      viewContext,
      surfaceBridge,
    ]
  );

  const showDock = isOpen && !hideOnChatPage;

  return (
    <ChatLauncherContext.Provider value={value}>
      <div className="flex min-h-0 flex-1 flex-row overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
        {showDock ? (
          <DockedChatPanel
            onClose={closeLauncher}
            viewContext={viewContext}
            currentUserName={currentUserName}
            currentUserImageUrl={currentUserImageUrl}
            currentUserRole={currentUserRole}
            bootstrapConversations={conversations}
            bootstrapActiveConversationId={activeConversationId}
            bootstrapMessages={messages}
            bootstrapChatModels={chatModels}
          />
        ) : null}
      </div>
    </ChatLauncherContext.Provider>
  );
}

export function ChatLauncherButton() {
  const pathname = usePathname();
  const { isOpen, toggleLauncher } = useChatLauncher();

  if (pathname === '/chat') {
    return null;
  }

  return (
    <Button
      type="button"
      variant={isOpen ? 'default' : 'outline'}
      size="icon"
      aria-label={isOpen ? 'Close Alice' : 'Open Alice'}
      aria-pressed={isOpen}
      className="cursor-pointer"
      onClick={() => {
        void toggleLauncher();
      }}
    >
      <Sparkles className="size-4" />
    </Button>
  );
}
