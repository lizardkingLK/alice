'use client';

import { useEffect, useState } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import { Maximize2, Minimize2 } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { ChatAgentsGallery } from '@/app/chat/_components/chat-agents-gallery';
import { ChatAgentCustomizePage } from '@/app/chat/_components/chat-agent-customize-page';
import { isAdmin, type AppRole } from '@/lib/rbac';

type AgentsPanelView = 'gallery' | 'detail';

type ChatAgentsPanelDialogProps = {
  readonly open: boolean;
  // eslint-disable-next-line no-unused-vars
  readonly onOpenChange: (open: boolean) => void;
  /** When set on open, jump straight to that agent’s detail. */
  readonly initialAgentId?: string | null;
  readonly currentUserName?: string | null;
  readonly currentUserEmail?: string | null;
  readonly currentUserRole?: AppRole | null;
};

type AgentsPanelBodyProps = {
  readonly view: AgentsPanelView;
  readonly detailAgentId: string | null;
  readonly currentUserName: string | null;
  readonly currentUserEmail: string | null;
  readonly currentUserRole: AppRole | null;
  // eslint-disable-next-line no-unused-vars
  readonly onSelectAgent: (agentId: string) => void;
  readonly onBack: () => void;
  readonly onDeleted: () => void;
  readonly onBeforeChat: () => void;
};

function AgentsPanelBody({
  view,
  detailAgentId,
  currentUserName,
  currentUserEmail,
  currentUserRole,
  onSelectAgent,
  onBack,
  onDeleted,
  onBeforeChat,
}: Readonly<AgentsPanelBodyProps>) {
  if (view === 'gallery') {
    return <ChatAgentsGallery onSelectAgent={onSelectAgent} />;
  }
  if (!detailAgentId) {
    return null;
  }
  return (
    <ChatAgentCustomizePage
      agentId={detailAgentId}
      canManageSystemAgents={isAdmin(currentUserRole)}
      currentUserName={currentUserName}
      currentUserEmail={currentUserEmail}
      onBack={onBack}
      onOpenAgent={onSelectAgent}
      onDeleted={onDeleted}
      onBeforeChat={onBeforeChat}
    />
  );
}

export function ChatAgentsPanelDialog({
  open,
  onOpenChange,
  initialAgentId = null,
  currentUserName = null,
  currentUserEmail = null,
  currentUserRole = null,
}: Readonly<ChatAgentsPanelDialogProps>) {
  const [view, setView] = useState<AgentsPanelView>('gallery');
  const [detailAgentId, setDetailAgentId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (initialAgentId) {
      setDetailAgentId(initialAgentId);
      setView('detail');
      return;
    }
    setView('gallery');
    setDetailAgentId(null);
  }, [open, initialAgentId]);

  const openAgent = (agentId: string) => {
    setDetailAgentId(agentId);
    setView('detail');
  };

  const backToGallery = () => {
    setView('gallery');
    setDetailAgentId(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        dismissOnOutsideClick={!isFullscreen}
        className={cn(
          'flex flex-col gap-0 overflow-hidden p-0',
          isFullscreen
            ? 'h-[100dvh] max-h-[100dvh] w-screen max-w-none rounded-none sm:max-w-none'
            : 'h-[min(90dvh,52rem)] max-h-[90dvh] w-[min(96vw,72rem)] sm:max-w-[72rem]'
        )}
      >
        <div className="border-border flex shrink-0 items-center justify-between gap-2 border-b px-4 py-2.5 pr-12">
          <div className="min-w-0">
            <DialogTitle className="text-sm font-semibold">
              {view === 'gallery' ? 'Agents' : 'Customize agent'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Browse Alice agents, customize them, or start a chat.
            </DialogDescription>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={
                  isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'
                }
                onClick={() => setIsFullscreen((value) => !value)}
              >
                {isFullscreen ? (
                  <Minimize2 className="size-4" />
                ) : (
                  <Maximize2 className="size-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <AgentsPanelBody
            view={view}
            detailAgentId={detailAgentId}
            currentUserName={currentUserName}
            currentUserEmail={currentUserEmail}
            currentUserRole={currentUserRole}
            onSelectAgent={openAgent}
            onBack={backToGallery}
            onDeleted={backToGallery}
            onBeforeChat={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
