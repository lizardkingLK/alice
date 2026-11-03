'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  Archive,
  ArchiveRestore,
  ChevronLeft,
  GitFork,
  MessageSquare,
  Save,
  Trash2,
} from '@repo/ui/lib/icons';
import {
  chatAgentDetailToRecord,
  draftToPatchBody,
  rememberPreferredChatAgent,
  type ChatAgentRecord,
} from '@/app/chat/_helpers/chat-agents-catalog';
import { buildChatWithAgentHref } from '@/app/chat/_helpers/chat-url';
import {
  deleteChatAgentClient,
  forkChatAgentClient,
  patchChatAgentClient,
} from '@/app/chat/_services/chat-agents.mutations.client';
import {
  getChatAgentClient,
  listChatSkillsClient,
  listChatToolsClient,
} from '@/app/chat/_services/chat-agents.reads.client';
import { ChatAgentAvatar } from '@/app/chat/_components/chat-agent-avatar';
import { ChatAgentAvatarDialog } from '@/app/chat/_components/chat-agent-avatar-dialog';
import { ChatAgentConfirmDialog } from '@/app/chat/_components/chat-agent-confirm-dialog';
import {
  ChatAgentCustomizeForm,
  type ChatAgentCustomizeDraft,
} from '@/app/chat/_components/chat-agent-customize-form';
import { ChatAgentCustomizeSkeleton } from '@/app/chat/_components/chat-agent-customize-skeleton';
import { errorMessage } from '@/lib/errors/error-message';

type ChatAgentCustomizePageProps = {
  readonly agentId: string;
  readonly canManageSystemAgents?: boolean;
  readonly currentUserName?: string | null;
  readonly currentUserEmail?: string | null;
  /** Back to gallery (panel) — required when embedded. */
  readonly onBack?: () => void;
  /** After fork, open the new agent in the panel. */
  // eslint-disable-next-line no-unused-vars
  readonly onOpenAgent?: (agentId: string) => void;
  /** After delete, return to gallery. */
  readonly onDeleted?: () => void;
  /** Before navigating to chat (e.g. close panel). */
  readonly onBeforeChat?: () => void;
  /** Notify parent that catalog data changed. */
  readonly onCatalogChanged?: () => void;
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

type CatalogKeys = {
  readonly toolKeys: readonly string[];
  readonly skillKeys: readonly string[];
};

type ChatAgentCustomizeLoadedProps = {
  readonly agent: ChatAgentRecord;
  readonly draft: ChatAgentCustomizeDraft;
  readonly catalogKeys: CatalogKeys;
  readonly canManageSystemAgents: boolean;
  readonly onBack?: () => void;
  // eslint-disable-next-line no-unused-vars
  readonly onOpenAgent?: (agentId: string) => void;
  readonly onDeleted?: () => void;
  readonly onBeforeChat?: () => void;
  readonly onCatalogChanged?: () => void;
  // eslint-disable-next-line no-unused-vars
  readonly onAgentChange: (agent: ChatAgentRecord) => void;
  // eslint-disable-next-line no-unused-vars
  readonly onDraftChange: (draft: ChatAgentCustomizeDraft) => void;
};

function ChatAgentCustomizeLoaded({
  agent,
  draft,
  catalogKeys,
  canManageSystemAgents,
  onBack,
  onOpenAgent,
  onDeleted,
  onBeforeChat,
  onCatalogChanged,
  onAgentChange,
  onDraftChange,
}: Readonly<ChatAgentCustomizeLoadedProps>) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isForking, setIsForking] = useState(false);
  const [isLifecyclePending, setIsLifecyclePending] = useState(false);
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [chatSaveConfirmOpen, setChatSaveConfirmOpen] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const baseline = useMemo(() => toDraft(agent), [agent]);
  const isDirty = !draftsEqual(draft, baseline);
  const isSystem = agent.kind === 'system';
  const isArchived = agent.status === 'archived';
  const isPersonal = agent.kind === 'personal';
  const canEdit = (!isSystem || canManageSystemAgents) && !isArchived;
  const showFork = isSystem && !isArchived;
  const showSave = canEdit;
  const showArchive = isPersonal && !isArchived;
  const showRestore = isPersonal && isArchived;
  const showDelete = isPersonal && isArchived;

  const persistDraft = async (): Promise<ChatAgentRecord | null> => {
    try {
      const updated = await patchChatAgentClient(
        agent.id,
        draftToPatchBody(draft, catalogKeys)
      );
      return chatAgentDetailToRecord(updated);
    } catch (error) {
      toast.error('Could not save agent', {
        description: errorMessage(error, 'Try again in a moment.'),
      });
      return null;
    }
  };

  const goToChat = (id: string) => {
    rememberPreferredChatAgent(id);
    onBeforeChat?.();
    router.push(buildChatWithAgentHref(id));
  };

  const applySavedAgent = (saved: ChatAgentRecord) => {
    onAgentChange(saved);
    onDraftChange(toDraft(saved));
    onCatalogChanged?.();
  };

  const handleConfirmedSave = async () => {
    setIsSaving(true);
    try {
      const saved = await persistDraft();
      if (!saved) {
        return;
      }
      applySavedAgent(saved);
      setSaveConfirmOpen(false);
      toast.success('Agent saved', {
        description: 'Your changes are stored on this agent.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmedSaveThenChat = async () => {
    setIsSaving(true);
    try {
      const saved = await persistDraft();
      if (!saved) {
        return;
      }
      applySavedAgent(saved);
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
    if (isArchived) {
      toast.error('Agent is archived', {
        description: 'Restore this agent before starting a chat.',
      });
      return;
    }
    if (canEdit && isDirty) {
      setChatSaveConfirmOpen(true);
      return;
    }
    goToChat(agent.id);
  };

  const handleFork = async () => {
    setIsForking(true);
    try {
      const forked = await forkChatAgentClient(agent.id);
      const record = chatAgentDetailToRecord(forked);
      toast.success('Agent forked', {
        description: `${record.name} · v${record.version}`,
      });
      onCatalogChanged?.();
      onOpenAgent?.(record.id);
    } catch (error) {
      toast.error('Could not fork agent', {
        description: errorMessage(
          error,
          'Only workspace agents can be forked once each.'
        ),
      });
    } finally {
      setIsForking(false);
    }
  };

  const handleArchive = async () => {
    setIsLifecyclePending(true);
    try {
      const archived = await patchChatAgentClient(agent.id, {
        status: 'archived',
      });
      applySavedAgent(chatAgentDetailToRecord(archived));
      setArchiveConfirmOpen(false);
      toast.success('Agent archived', {
        description: 'Find it under the Archived tab in Agents.',
      });
    } catch (error) {
      toast.error('Could not archive agent', {
        description: errorMessage(
          error,
          'Only personal agents can be archived.'
        ),
      });
    } finally {
      setIsLifecyclePending(false);
    }
  };

  const handleRestore = async () => {
    setIsLifecyclePending(true);
    try {
      const restored = await patchChatAgentClient(agent.id, {
        status: 'active',
      });
      applySavedAgent(chatAgentDetailToRecord(restored));
      setRestoreConfirmOpen(false);
      toast.success('Agent restored', {
        description: 'This agent is editable again under Mine.',
      });
    } catch (error) {
      toast.error('Could not restore agent', {
        description: errorMessage(
          error,
          'Only archived personal agents can be restored.'
        ),
      });
    } finally {
      setIsLifecyclePending(false);
    }
  };

  const handleDelete = async () => {
    setIsLifecyclePending(true);
    try {
      await deleteChatAgentClient(agent.id);
      setDeleteConfirmOpen(false);
      toast.success('Agent deleted', {
        description: 'This agent was removed from the workspace catalog.',
      });
      onCatalogChanged?.();
      onDeleted?.();
    } catch (error) {
      toast.error('Could not delete agent', {
        description: errorMessage(
          error,
          'Only personal agents can be deleted.'
        ),
      });
    } finally {
      setIsLifecyclePending(false);
    }
  };

  const patchDraft = (patch: Partial<ChatAgentCustomizeDraft>) => {
    onDraftChange({ ...draft, ...patch });
  };

  return (
    <div className="bg-background flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="border-border flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {onBack ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Back to Agents gallery"
              onClick={onBack}
            >
              <ChevronLeft className="size-4" />
            </Button>
          ) : null}
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
              {agent.isDefault ? (
                <Badge variant="outline" className="text-[10px] uppercase">
                  Default
                </Badge>
              ) : null}
              {isArchived ? (
                <Badge variant="outline" className="text-[10px] uppercase">
                  Archived
                </Badge>
              ) : null}
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
        <CustomizeLifecycleActions
          showArchive={showArchive}
          showRestore={showRestore}
          showDelete={showDelete}
          isArchived={isArchived}
          onArchive={() => setArchiveConfirmOpen(true)}
          onRestore={() => setRestoreConfirmOpen(true)}
          onDelete={() => setDeleteConfirmOpen(true)}
          onChat={handleChatClick}
        />
      </header>

      {isArchived ? (
        <div className="border-border bg-muted/40 text-muted-foreground shrink-0 border-b px-4 py-2.5 text-xs sm:px-6">
          This agent is archived and read-only. Restore it to edit or chat, or
          delete it permanently.
        </div>
      ) : null}

      <div className="no-scrollbar flex min-h-0 flex-1 justify-center overflow-y-auto px-4 py-6 pb-8 sm:px-6">
        <div className="w-full max-w-5xl">
          <ChatAgentCustomizeForm
            draft={draft}
            kind={agent.kind}
            canEdit={canEdit}
            showCamera={canEdit}
            onOpenAvatarDialog={() => setAvatarDialogOpen(true)}
            onDraftChange={patchDraft}
          />
        </div>
      </div>

      <CustomizeFooterActions
        showFork={showFork}
        showSave={showSave}
        isForking={isForking}
        isSaving={isSaving}
        isDirty={isDirty}
        onFork={() => {
          void handleFork();
        }}
        onSave={() => setSaveConfirmOpen(true)}
      />

      <ChatAgentAvatarDialog
        open={avatarDialogOpen}
        name={draft.name}
        kind={agent.kind}
        avatarStyle={draft.avatarStyle}
        avatarSeed={draft.avatarSeed}
        readOnly={!canEdit}
        onOpenChange={setAvatarDialogOpen}
        onAvatarStyleChange={(style) => patchDraft({ avatarStyle: style })}
        onAvatarSeedChange={(seed) => patchDraft({ avatarSeed: seed })}
        onShuffleSeed={() => patchDraft({ avatarSeed: randomAvatarSeed() })}
      />

      <ChatAgentConfirmDialog
        open={saveConfirmOpen}
        title="Save agent?"
        description="Your changes will be saved to this agent."
        confirmLabel="Save"
        pendingLabel="Saving…"
        isPending={isSaving}
        onOpenChange={setSaveConfirmOpen}
        onConfirm={() => {
          void handleConfirmedSave();
        }}
      />

      <ChatAgentConfirmDialog
        open={chatSaveConfirmOpen}
        title="Save before chatting?"
        description="You have unsaved changes. Save them before opening chat with this agent."
        confirmLabel="Save and chat"
        pendingLabel="Saving…"
        isPending={isSaving}
        onOpenChange={setChatSaveConfirmOpen}
        onConfirm={() => {
          void handleConfirmedSaveThenChat();
        }}
      />

      <ChatAgentConfirmDialog
        open={archiveConfirmOpen}
        title="Archive agent?"
        description="This agent moves to Archived and becomes read-only until you restore it."
        confirmLabel="Archive"
        pendingLabel="Archiving…"
        isPending={isLifecyclePending}
        onOpenChange={setArchiveConfirmOpen}
        onConfirm={() => {
          void handleArchive();
        }}
      />

      <ChatAgentConfirmDialog
        open={restoreConfirmOpen}
        title="Restore agent?"
        description="This agent returns to Mine and can be edited again."
        confirmLabel="Restore"
        pendingLabel="Restoring…"
        isPending={isLifecyclePending}
        onOpenChange={setRestoreConfirmOpen}
        onConfirm={() => {
          void handleRestore();
        }}
      />

      <ChatAgentConfirmDialog
        open={deleteConfirmOpen}
        title="Delete agent?"
        description="This permanently removes the agent. This cannot be undone."
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        isPending={isLifecyclePending}
        destructive
        onOpenChange={setDeleteConfirmOpen}
        onConfirm={() => {
          void handleDelete();
        }}
      />
    </div>
  );
}

type CustomizeFooterActionsProps = {
  readonly showFork: boolean;
  readonly showSave: boolean;
  readonly isForking: boolean;
  readonly isSaving: boolean;
  readonly isDirty: boolean;
  readonly onFork: () => void;
  readonly onSave: () => void;
};

function CustomizeFooterActions({
  showFork,
  showSave,
  isForking,
  isSaving,
  isDirty,
  onFork,
  onSave,
}: Readonly<CustomizeFooterActionsProps>) {
  return (
    <footer className="border-border bg-background flex shrink-0 flex-wrap items-center justify-end gap-2 border-t px-4 py-3 sm:px-6">
      {showFork ? (
        <Button
          type="button"
          variant="default"
          disabled={isForking}
          onClick={onFork}
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
          onClick={onSave}
        >
          <Save data-icon="inline-start" />
          Save
        </Button>
      ) : null}
    </footer>
  );
}

type CustomizeLifecycleActionsProps = {
  readonly showArchive: boolean;
  readonly showRestore: boolean;
  readonly showDelete: boolean;
  readonly isArchived: boolean;
  readonly onArchive: () => void;
  readonly onRestore: () => void;
  readonly onDelete: () => void;
  readonly onChat: () => void;
};

function CustomizeLifecycleActions({
  showArchive,
  showRestore,
  showDelete,
  isArchived,
  onArchive,
  onRestore,
  onDelete,
  onChat,
}: Readonly<CustomizeLifecycleActionsProps>) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {showArchive ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Archive agent"
              onClick={onArchive}
            >
              <Archive className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Archive</TooltipContent>
        </Tooltip>
      ) : null}
      {showRestore ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Restore agent"
              onClick={onRestore}
            >
              <ArchiveRestore className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Restore</TooltipContent>
        </Tooltip>
      ) : null}
      {showDelete ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Delete agent"
              onClick={onDelete}
            >
              <Trash2 className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Delete</TooltipContent>
        </Tooltip>
      ) : null}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Chat with this agent"
            disabled={isArchived}
            onClick={onChat}
          >
            <MessageSquare className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Chat</TooltipContent>
      </Tooltip>
    </div>
  );
}

export function ChatAgentCustomizePage({
  agentId,
  canManageSystemAgents = false,
  currentUserName = null,
  onBack,
  onOpenAgent,
  onDeleted,
  onBeforeChat,
  onCatalogChanged,
}: Readonly<ChatAgentCustomizePageProps>) {
  const [agent, setAgent] = useState<ChatAgentRecord | null>(null);
  const [draft, setDraft] = useState<ChatAgentCustomizeDraft | null>(null);
  const [catalogKeys, setCatalogKeys] = useState<CatalogKeys>({
    toolKeys: [],
    skillKeys: [],
  });
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadAgent = useCallback(async () => {
    setIsReady(false);
    setLoadError(null);
    try {
      const [detail, tools, skills] = await Promise.all([
        getChatAgentClient(agentId),
        listChatToolsClient(),
        listChatSkillsClient(),
      ]);
      const record = chatAgentDetailToRecord(detail, { currentUserName });
      setAgent(record);
      setDraft(toDraft(record));
      setCatalogKeys({
        toolKeys: tools.map((tool) => tool.key),
        skillKeys: skills.map((skill) => skill.key),
      });
    } catch (error) {
      console.error('Failed to load chat agent:', error);
      setAgent(null);
      setDraft(null);
      setLoadError(errorMessage(error, 'This agent is not available.'));
    } finally {
      setIsReady(true);
    }
  }, [agentId, currentUserName]);

  useEffect(() => {
    void loadAgent();
  }, [loadAgent]);

  if (!isReady) {
    return <ChatAgentCustomizeSkeleton />;
  }

  if (!agent || !draft) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6 py-12 pb-8 text-center">
        <p className="text-muted-foreground max-w-sm text-sm">
          {loadError ??
            'This agent is not available. Open the gallery and try again.'}
        </p>
        {onBack ? (
          <Button type="button" variant="outline" onClick={onBack}>
            <ChevronLeft className="size-4" data-icon="inline-start" />
            Back to Agents
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <ChatAgentCustomizeLoaded
      agent={agent}
      draft={draft}
      catalogKeys={catalogKeys}
      canManageSystemAgents={canManageSystemAgents}
      onBack={onBack}
      onOpenAgent={onOpenAgent}
      onDeleted={onDeleted}
      onBeforeChat={onBeforeChat}
      onCatalogChanged={onCatalogChanged}
      onAgentChange={setAgent}
      onDraftChange={setDraft}
    />
  );
}
