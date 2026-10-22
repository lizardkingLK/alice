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
import { cn } from '@repo/ui/lib/utils';
import type { ChatViewContext } from '@repo/types/api/v1';
import type { AppRole } from '@/lib/rbac';
import {
  captureChatDockPageContext,
  type ChatDockPageContext,
} from '@/app/chat/_components/chat-dock-context-bar';
import { DockedChatPanel } from '@/app/chat/_components/docked-chat-panel';
import type { WorkflowAliceBridgeValue } from '@/app/projects/_components/project-details/workflow-alice-bridge';

type ChatLauncherContextValue = {
  readonly isOpen: boolean;
  readonly openLauncher: () => void;
  readonly closeLauncher: () => void;
  readonly toggleLauncher: () => void;
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
  const [hasOpened, setHasOpened] = useState(false);
  const [pageContext, setPageContext] = useState<ChatDockPageContext | null>(
    null
  );
  const [viewContext, setViewContext] = useState<ChatViewContext | null>(null);
  const [surfaceBridge, setSurfaceBridge] =
    useState<WorkflowAliceBridgeValue | null>(null);

  const openLauncher = useCallback(() => {
    setPageContext(captureChatDockPageContext(pathname));
    setHasOpened(true);
    setIsOpen(true);
  }, [pathname]);

  const closeLauncher = useCallback(() => {
    setIsOpen(false);
  }, []);

  const dismissPageContext = useCallback(() => {
    setPageContext(null);
  }, []);

  const toggleLauncher = useCallback(() => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    openLauncher();
  }, [isOpen, openLauncher]);

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

  const showDock = hasOpened && !hideOnChatPage;

  return (
    <ChatLauncherContext.Provider value={value}>
      <div className="flex min-h-0 flex-1 flex-row overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
        {showDock ? (
          <div
            className={cn(
              'flex h-full min-h-0 shrink-0 flex-col',
              !isOpen && 'hidden'
            )}
          >
            <DockedChatPanel
              onClose={closeLauncher}
              viewContext={viewContext}
              pageContext={pageContext}
              onDismissPageContext={dismissPageContext}
              currentUserName={currentUserName}
              currentUserImageUrl={currentUserImageUrl}
              currentUserRole={currentUserRole}
            />
          </div>
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
        toggleLauncher();
      }}
    >
      <Sparkles className="size-4" />
    </Button>
  );
}
