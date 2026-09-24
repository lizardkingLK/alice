'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from '@repo/ui/components/ui/sonner';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import {
  ArrowLeft,
  GitFork,
  MessageSquare,
  Save,
  Shield,
} from '@repo/ui/lib/icons';
import {
  claimPersonalAgentAuthor,
  forkChatAgent,
  getChatAgentById,
  markAgentAsSystem,
  saveAgentDraft,
  subscribeChatAgentsCatalog,
  type ChatAgentRecord,
} from '@/app/chat/_helpers/chat-agents-catalog';
import {
  buildChatAgentsGalleryHref,
  buildChatAgentCustomizeHref,
  buildChatWithAgentHref,
} from '@/app/chat/_helpers/chat-url';
import { ChatAgentAvatar } from '@/app/chat/_components/chat-agent-avatar';
import { ChatAgentAvatarDialog } from '@/app/chat/_components/chat-agent-avatar-dialog';
import { ChatAgentConfirmDialog } from '@/app/chat/_components/chat-agent-confirm-dialog';
import {
  ChatAgentCustomizeForm,
  type ChatAgentCustomizeDraft,
} from '@/app/chat/_components/chat-agent-customize-form';
import { ChatAgentCustomizeSkeleton } from '@/app/chat/_components/chat-agent-customize-skeleton';

type ChatAgentCustomizePageProps = {
  readonly agentId: string;
  readonly canManageSystemAgents?: boolean;
  readonly currentUserName?: string | null;
  readonly currentUserEmail?: string | null;
};

function toDraft(agent: ChatAgentRecord): ChatAgentCustomizeDraft {
  return {
    name: agent.name,
    title: agent.title,
    description: agent.description,
    instructions: agent.instructions,
    tagline: agent.tagline,
    skills: agent.skills,
    tools: agent.tools,
    autonomy: agent.autonomy,
    avatarStyle: agent.avatarStyle,
    avatarSeed: agent.avatarSeed,
  };
}

function draftsEqual(
  a: ChatAgentCustomizeDraft,
  b: ChatAgentCustomizeDraft
): boolean {
  return (
    a.name === b.name &&
    a.title === b.title &&
    a.description === b.description &&
    a.instructions === b.instructions &&
    a.tagline === b.tagline &&
    a.skills === b.skills &&
    a.tools === b.tools &&
    a.autonomy === b.autonomy &&
    a.avatarStyle === b.avatarStyle &&
    a.avatarSeed === b.avatarSeed
  );
}

function randomAvatarSeed(): string {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, '0')
    ).join('');
    return `alice-${hex}`;
  }
  return `alice-${Date.now().toString(36)}`;
}

export function ChatAgentCustomizePage({
  agentId,
  canManageSystemAgents = false,
  currentUserName = null,
  currentUserEmail = null,
}: Readonly<ChatAgentCustomizePageProps>) {
  const router = useRouter();
  const [agent, setAgent] = useState<ChatAgentRecord | null>(null);
  const [draft, setDraft] = useState<ChatAgentCustomizeDraft | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isForking, setIsForking] = useState(false);
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [chatSaveConfirmOpen, setChatSaveConfirmOpen] = useState(false);

  useEffect(() => {
    const sync = () => {
      const found = getChatAgentById(agentId);
      setAgent(found);
      setDraft(found ? toDraft(found) : null);
      setIsReady(true);
    };
    sync();
    return subscribeChatAgentsCatalog(sync);
  }, [agentId]);

  useEffect(() => {
    const name = currentUserName?.trim();
    if (!name || !agentId) {
      return;
    }
    claimPersonalAgentAuthor(agentId, {
      name,
      email: currentUserEmail?.trim() || undefined,
    });
  }, [agentId, currentUserName, currentUserEmail]);

  const baseline = useMemo(() => (agent ? toDraft(agent) : null), [agent]);
  const isDirty =
    draft !== null && baseline !== null && !draftsEqual(draft, baseline);

  if (!isReady) {
    return <ChatAgentCustomizeSkeleton />;
  }

  if (!agent || !draft) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6 py-12 pb-8 text-center">
        <p className="text-muted-foreground max-w-sm text-sm">
          This agent isn&apos;t available in this browser. Forks are stored
          locally for now — open the gallery and fork again if needed.
        </p>
        <Button type="button" variant="outline" asChild>
          <Link href={buildChatAgentsGalleryHref()}>
            <ArrowLeft className="size-4" data-icon="inline-start" />
            Back to Agents
          </Link>
        </Button>
      </div>
    );
  }

  const isSystem = agent.kind === 'system';
  const canEdit = !isSystem || canManageSystemAgents;
  const showCamera = canEdit;
  const showFork = isSystem;
  const showSave = canEdit;
  const showMarkAsSystem = canManageSystemAgents && !isSystem;

  const persistDraft = (): ChatAgentRecord | null =>
    saveAgentDraft(agent.id, draft, {
      allowSystemEdit: canManageSystemAgents && isSystem,
    });

  const goToChat = (id: string) => {
    router.push(buildChatWithAgentHref(id));
  };

  const handleConfirmedSave = () => {
    setIsSaving(true);
    try {
      const saved = persistDraft();
      if (!saved) {
        toast.error('Could not save agent', {
          description: 'Try again, or check that you can edit this agent.',
        });
        return;
      }
      setAgent(saved);
      setDraft(toDraft(saved));
      setSaveConfirmOpen(false);
      toast.success('Agent saved', {
        description: 'Your changes are stored on this agent.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmedSaveThenChat = () => {
    setIsSaving(true);
    try {
      const saved = persistDraft();
      if (!saved) {
        toast.error('Could not save agent', {
          description: 'Try again, or check that you can edit this agent.',
        });
        return;
      }
      setAgent(saved);
      setDraft(toDraft(saved));
      setChatSaveConfirmOpen(false);
      toast.success('Agent saved', {
        description: 'Opening chat with your updated agent.',
      });
      goToChat(saved.id);
    } finally {
      setIsSaving(false);
    }
  };

  const handleChatClick = () => {
    if (canEdit && isDirty) {
      setChatSaveConfirmOpen(true);
      return;
    }
    goToChat(agent.id);
  };

  const handleFork = () => {
    setIsForking(true);
    try {
      const authorName =
        currentUserName?.trim() ||
        currentUserEmail?.trim() ||
        'You';
      const forked = forkChatAgent(agent, {
        name: authorName,
        email: currentUserEmail?.trim() || undefined,
      });
      if (!forked) {
        toast.error('Could not fork agent', {
          description: 'Only system templates can be forked.',
        });
        return;
      }
      toast.success('Agent forked', {
        description: `${forked.name} · v${forked.version}`,
      });
      router.push(buildChatAgentCustomizeHref(forked.id));
    } finally {
      setIsForking(false);
    }
  };

  const handleMarkAsSystem = () => {
    const marked = markAgentAsSystem(agent.id);
    if (!marked) {
      toast.error('Could not update agent', {
        description: 'Only personal agents can be marked as system templates.',
      });
      return;
    }
    setAgent(marked);
    setDraft(toDraft(marked));
    toast.success('Marked as system', {
      description: 'This agent is now a forkable system template.',
    });
  };

  return (
    <div className="bg-background flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="border-border flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Button type="button" variant="ghost" size="icon" asChild>
            <Link
              href={buildChatAgentsGalleryHref()}
              aria-label="Back to Agents gallery"
            >
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <ChatAgentAvatar
            name={draft.name}
            kind={agent.kind}
            avatarStyle={draft.avatarStyle}
            avatarSeed={draft.avatarSeed}
            size="sm"
          />
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-sm font-semibold">{draft.name}</h1>
              <Badge variant="secondary" className="text-[10px] uppercase">
                {isSystem ? 'System' : `v${agent.version}`}
              </Badge>
            </div>
            {draft.title.trim() ? (
              <p className="text-muted-foreground truncate text-xs">
                {draft.title}
              </p>
            ) : null}
            <p className="text-muted-foreground truncate text-xs">
              by {agent.authorName}
            </p>
          </div>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Chat with this agent"
              onClick={handleChatClick}
            >
              <MessageSquare className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Chat</TooltipContent>
        </Tooltip>
      </header>

      <div className="no-scrollbar flex min-h-0 flex-1 justify-center overflow-y-auto px-4 py-6 pb-8 sm:px-6">
        <div className="w-full max-w-5xl">
          <ChatAgentCustomizeForm
            draft={draft}
            kind={agent.kind}
            canEdit={canEdit}
            showCamera={showCamera}
            onOpenAvatarDialog={() => setAvatarDialogOpen(true)}
            onDraftChange={(patch) =>
              setDraft((prev) => (prev ? { ...prev, ...patch } : prev))
            }
          />
        </div>
      </div>

      <footer className="border-border bg-background flex shrink-0 flex-wrap items-center justify-end gap-2 border-t px-4 py-3 sm:px-6">
        {showMarkAsSystem ? (
          <Button
            type="button"
            variant="outline"
            onClick={handleMarkAsSystem}
          >
            <Shield data-icon="inline-start" />
            Mark as system
          </Button>
        ) : null}
        {showFork ? (
          <Button
            type="button"
            variant="default"
            disabled={isForking}
            onClick={handleFork}
          >
            <GitFork data-icon="inline-start" />
            Fork
          </Button>
        ) : null}
        {showSave ? (
          <Button
            type="button"
            variant={showFork ? 'secondary' : 'default'}
            disabled={isSaving || !isDirty}
            onClick={() => setSaveConfirmOpen(true)}
          >
            <Save data-icon="inline-start" />
            Save
          </Button>
        ) : null}
      </footer>

      <ChatAgentAvatarDialog
        open={avatarDialogOpen}
        name={draft.name}
        kind={agent.kind}
        avatarStyle={draft.avatarStyle}
        avatarSeed={draft.avatarSeed}
        readOnly={!canEdit}
        onOpenChange={setAvatarDialogOpen}
        onAvatarStyleChange={(style) =>
          setDraft((prev) => (prev ? { ...prev, avatarStyle: style } : prev))
        }
        onAvatarSeedChange={(seed) =>
          setDraft((prev) => (prev ? { ...prev, avatarSeed: seed } : prev))
        }
        onShuffleSeed={() =>
          setDraft((prev) =>
            prev ? { ...prev, avatarSeed: randomAvatarSeed() } : prev
          )
        }
      />

      <ChatAgentConfirmDialog
        open={saveConfirmOpen}
        title="Save agent?"
        description="Your changes will be saved to this agent."
        confirmLabel="Save"
        isPending={isSaving}
        onOpenChange={setSaveConfirmOpen}
        onConfirm={handleConfirmedSave}
      />

      <ChatAgentConfirmDialog
        open={chatSaveConfirmOpen}
        title="Save before chatting?"
        description="You have unsaved changes. Save them before opening chat with this agent."
        confirmLabel="Save and chat"
        isPending={isSaving}
        onOpenChange={setChatSaveConfirmOpen}
        onConfirm={handleConfirmedSaveThenChat}
      />
    </div>
  );
}
