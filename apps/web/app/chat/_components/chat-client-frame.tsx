'use client';

import {
  useState,
  type ClipboardEvent,
  type ComponentType,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { cn } from '@repo/ui/lib/utils';
import { Textarea } from '@repo/ui/components/ui/textarea';
import { Button } from '@repo/ui/components/ui/button';
import { Separator } from '@repo/ui/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import {
  Send,
  Sparkles,
  PanelLeft,
  PanelLeftClose,
  Paperclip,
} from '@repo/ui/lib/icons';
import type { ChatModelOption } from '@repo/types';
import type { ChatMessage } from './chat-client.types';
import type { ChatConversation } from '../_services/chat.mutations.client';
import {
  ChatAttachmentTiles,
  type PendingChatAttachment,
} from './chat-attachment-tiles';
import { RegistryConfirmDialog } from '@/components/registry-confirm-dialog';
import ChatClientSidebar from '@/app/chat/_components/chat-client-sidebar';
import { ChatRenameDialog } from '@/app/chat/_components/chat-rename-dialog';
import ChatClientHeaderActions from '@/app/chat/_components/chat-client-header-actions';
import ChatClientMain from '@/app/chat/_components/chat-client-main';
import { ChatAgentAvatar } from '@/app/chat/_components/chat-agent-avatar';
import { ChatAssistantNameBlock } from '@/app/chat/_components/chat-assistant-name-block';
import { ChatAgentsPanelDialog } from '@/app/chat/_components/chat-agents-panel-dialog';
import { useBoundChatAgent } from '@/app/chat/_helpers/use-bound-chat-agent';
import type { DashboardBreadcrumbOverride } from '@/app/dashboard/_components/dashboard-breadcrumb';
import type { AppRole } from '@/lib/rbac';

const CHAT_PANEL_HEADER_CLASS =
  'border-border flex h-14 shrink-0 items-center border-b px-3';

/** Match dashboard navbar (`h-16`) when Alice is docked beside the shell. */
const CHAT_DOCKED_HEADER_CLASS =
  'border-border flex h-16 shrink-0 items-center border-b px-3';

const HEADER_IDENTITY_BUTTON_CLASS =
  'hover:bg-muted/60 flex min-w-0 items-center justify-start gap-2 rounded-lg px-1.5 py-1 text-left sm:gap-3';

function DefaultAliceMark() {
  return (
    <>
      <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
        <Sparkles className="size-4" />
      </div>
      <ChatAssistantNameBlock />
    </>
  );
}

type ChatFrameHeaderIdentityProps = {
  readonly isPage: boolean;
  readonly identity: ReturnType<typeof useBoundChatAgent>;
  readonly onOpenGallery: () => void;
  // eslint-disable-next-line no-unused-vars
  readonly onOpenDetail: (agentId: string) => void;
};

function ChatFrameHeaderIdentity({
  isPage,
  identity,
  onOpenGallery,
  onOpenDetail,
}: Readonly<ChatFrameHeaderIdentityProps>) {
  if (identity) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={HEADER_IDENTITY_BUTTON_CLASS}
            aria-label={`Customize ${identity.name}`}
            onClick={() => onOpenDetail(identity.id)}
          >
            <ChatAgentAvatar
              name={identity.name}
              kind={identity.kind}
              avatarStyle={identity.avatarStyle}
              avatarSeed={identity.avatarSeed}
              size="sm"
            />
            <ChatAssistantNameBlock identity={identity} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Customize agent</TooltipContent>
      </Tooltip>
    );
  }

  if (!isPage) {
    return <DefaultAliceMark />;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={HEADER_IDENTITY_BUTTON_CLASS}
          aria-label="Browse agents"
          onClick={onOpenGallery}
        >
          <DefaultAliceMark />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Browse agents</TooltipContent>
    </Tooltip>
  );
}

type ChatFrameHistoryToggleProps = {
  readonly showHistory: boolean;
  readonly onToggleHistory: () => void;
};

function ChatFrameHistoryToggle({
  showHistory,
  onToggleHistory,
}: Readonly<ChatFrameHistoryToggleProps>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggleHistory}
          aria-expanded={showHistory}
          aria-controls="chat-history-sidebar"
          aria-label={showHistory ? 'Hide chat history' : 'Show chat history'}
        >
          {showHistory ? <PanelLeftClose /> : <PanelLeft />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {showHistory ? 'Hide history' : 'Show history'}
      </TooltipContent>
    </Tooltip>
  );
}

type ChatFramePanelHeaderProps = {
  readonly isPage: boolean;
  readonly variant: 'page' | 'drawer' | 'docked';
  readonly showHistory: boolean;
  readonly assistantIdentity: ReturnType<typeof useBoundChatAgent>;
  readonly chatModels: readonly ChatModelOption[];
  readonly selectedIntegrationId: string | undefined;
  readonly canManageChatModels: boolean;
  readonly isInputDisabled: boolean;
  readonly isMarkingDefault: boolean;
  readonly onToggleHistory: () => void;
  readonly onOpenGallery: () => void;
  // eslint-disable-next-line no-unused-vars -- callback prop types
  readonly onOpenDetail: (agentId: string) => void;
  readonly onNewChat: () => void;
  readonly onMarkSelectedAsDefault: () => Promise<void>;
  // eslint-disable-next-line no-unused-vars -- callback prop types
  readonly onSelectedIntegrationIdChange: (value: string) => void;
  readonly onClose?: () => void;
};

function ChatFramePanelHeader({
  isPage,
  variant,
  showHistory,
  assistantIdentity,
  chatModels,
  selectedIntegrationId,
  canManageChatModels,
  isInputDisabled,
  isMarkingDefault,
  onToggleHistory,
  onOpenGallery,
  onOpenDetail,
  onNewChat,
  onMarkSelectedAsDefault,
  onSelectedIntegrationIdChange,
  onClose,
}: Readonly<ChatFramePanelHeaderProps>) {
  const isDocked = variant === 'docked';

  return (
    <header
      className={cn(
        isDocked ? CHAT_DOCKED_HEADER_CLASS : CHAT_PANEL_HEADER_CLASS,
        'justify-between gap-3',
        isDocked ? 'px-3' : 'sm:px-6'
      )}
    >
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        {isPage ? (
          <ChatFrameHistoryToggle
            showHistory={showHistory}
            onToggleHistory={onToggleHistory}
          />
        ) : null}
        <ChatFrameHeaderIdentity
          isPage={isPage}
          identity={assistantIdentity}
          onOpenGallery={onOpenGallery}
          onOpenDetail={onOpenDetail}
        />
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <ChatClientHeaderActions
          variant={variant}
          isPending={isInputDisabled}
          chatModels={chatModels}
          selectedIntegrationId={selectedIntegrationId}
          canManageChatModels={canManageChatModels}
          isMarkingDefault={isMarkingDefault}
          onSelectedIntegrationIdChange={onSelectedIntegrationIdChange}
          onMarkSelectedAsDefault={onMarkSelectedAsDefault}
          onNewChat={onNewChat}
          onOpenAgentsGallery={isPage ? onOpenGallery : undefined}
          onClose={onClose}
        />
      </div>
    </header>
  );
}

type ChatFrameComposerProps = {
  readonly variant: 'page' | 'drawer' | 'docked';
  readonly pendingAttachments: PendingChatAttachment[];
  readonly inputValue: string;
  readonly isInputDisabled: boolean;
  readonly fileInputRef: RefObject<HTMLInputElement | null>;
  // eslint-disable-next-line no-unused-vars -- callback prop types
  readonly onRemoveAttachment: (id: string) => void;
  // eslint-disable-next-line no-unused-vars -- callback prop types
  readonly onFormSubmit: (event: FormEvent) => void;
  // eslint-disable-next-line no-unused-vars -- callback prop types
  readonly onFileSelect: (files: FileList) => void;
  readonly onComposerKeyDown: (
    // eslint-disable-next-line no-unused-vars -- callback prop types
    event: KeyboardEvent<HTMLTextAreaElement>
  ) => void;
  // eslint-disable-next-line no-unused-vars -- callback prop types
  readonly onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  // eslint-disable-next-line no-unused-vars -- callback prop types
  readonly onInputChange: (value: string) => void;
};

function ChatFrameComposer({
  variant,
  pendingAttachments,
  inputValue,
  isInputDisabled,
  fileInputRef,
  onRemoveAttachment,
  onFormSubmit,
  onFileSelect,
  onComposerKeyDown,
  onPaste,
  onInputChange,
}: Readonly<ChatFrameComposerProps>) {
  const isDocked = variant === 'docked';
  const isUploading = pendingAttachments.some((a) => a.isUploading);
  const canSend =
    (Boolean(inputValue.trim()) || pendingAttachments.length > 0) &&
    !isInputDisabled &&
    !isUploading;

  return (
    <div
      className={cn('bg-muted/20 shrink-0', isDocked ? 'p-2.5' : 'p-3 sm:p-4')}
    >
      <div className="mx-auto max-w-3xl">
        <ChatAttachmentTiles
          attachments={pendingAttachments}
          onRemove={onRemoveAttachment}
          disabled={isInputDisabled}
        />
        <form
          onSubmit={onFormSubmit}
          className={cn(
            'flex items-end',
            isDocked ? 'gap-1.5' : 'gap-2 sm:gap-3'
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                onFileSelect(e.target.files);
              }
            }}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size={isDocked ? 'icon' : 'icon-lg'}
                disabled={isInputDisabled}
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach files (JSON, CSV, etc.)"
              >
                <Paperclip className={isDocked ? 'size-4' : 'size-5'} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Attach files (or paste with Ctrl+V)
            </TooltipContent>
          </Tooltip>

          <Textarea
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={onComposerKeyDown}
            onPaste={onPaste}
            disabled={isInputDisabled}
            rows={1}
            placeholder="Enter your message..."
            className={cn(
              'bg-background flex-1 resize-none',
              isDocked
                ? 'max-h-28 min-h-8 px-2.5 py-1.5 text-sm'
                : 'max-h-40 min-h-10 px-3 py-2.5 sm:px-4'
            )}
          />
          <Button
            type="submit"
            size={isDocked ? 'icon' : 'icon-lg'}
            disabled={!canSend}
            aria-label="Send message"
          >
            <Send />
          </Button>
        </form>
      </div>
    </div>
  );
}

type ChatClientFrameProps = {
  readonly isPage: boolean;
  readonly variant: 'page' | 'drawer' | 'docked';
  readonly chatBreadcrumbTrail: readonly DashboardBreadcrumbOverride[] | null;
  readonly isLoadingConversations: boolean;
  readonly isLoadingHistory: boolean;
  readonly activeConversationId: string | undefined;
  readonly showHistory: boolean;
  readonly conversationSearch: string;
  readonly conversations: ChatConversation[];
  readonly chatModels: readonly ChatModelOption[];
  readonly selectedIntegrationId: string | undefined;
  readonly canManageChatModels: boolean;
  readonly isInputDisabled: boolean;
  readonly isMarkingDefault: boolean;
  readonly isPending: boolean;
  readonly isActiveConversationProcessing: boolean;
  readonly showHero: boolean;
  readonly showEmptyThread: boolean;
  readonly messages: ChatMessage[];
  readonly error: string | null;
  readonly currentUserName?: string | null;
  readonly currentUserEmail?: string | null;
  readonly currentUserImageUrl?: string | null;
  readonly currentUserRole?: AppRole | null;
  readonly messagesEndRef: RefObject<HTMLDivElement | null>;
  readonly pendingAttachments: PendingChatAttachment[];
  readonly inputValue: string;
  readonly fileInputRef: RefObject<HTMLInputElement | null>;
  readonly boundAgentId?: string;
  readonly conversationToDelete: ChatConversation | null;
  readonly conversationToRename: ChatConversation | null;
  readonly isDeleting: boolean;
  readonly isRenaming: boolean;
  readonly onClose?: () => void;
  // eslint-disable-next-line no-unused-vars -- callback prop types
  readonly onConversationSearchChange: (value: string) => void;
  // eslint-disable-next-line no-unused-vars -- callback prop types
  readonly onSelectConversation: (id: string) => void;
  readonly onNewChat: () => void;
  readonly onRenameConversationClick: (
    // eslint-disable-next-line no-unused-vars -- callback prop types
    e: React.MouseEvent,
    // eslint-disable-next-line no-unused-vars -- callback prop types
    conversation: ChatConversation
  ) => void;
  readonly onDeleteConversationClick: (
    // eslint-disable-next-line no-unused-vars -- callback prop types
    e: React.MouseEvent,
    // eslint-disable-next-line no-unused-vars -- callback prop types
    conversation: ChatConversation
  ) => void;
  readonly onToggleHistory: () => void;
  readonly onMarkSelectedAsDefault: () => Promise<void>;
  // eslint-disable-next-line no-unused-vars -- callback prop types
  readonly onSelectedIntegrationIdChange: (value: string) => void;
  // eslint-disable-next-line no-unused-vars -- callback prop types
  readonly onSendMessage: (text: string) => void;
  // eslint-disable-next-line no-unused-vars -- callback prop types
  readonly onRemoveAttachment: (id: string) => void;
  // eslint-disable-next-line no-unused-vars -- callback prop types
  readonly onFormSubmit: (event: FormEvent) => void;
  // eslint-disable-next-line no-unused-vars -- callback prop types
  readonly onFileSelect: (files: FileList) => void;
  readonly onComposerKeyDown: (
    // eslint-disable-next-line no-unused-vars -- callback prop types
    event: KeyboardEvent<HTMLTextAreaElement>
  ) => void;
  // eslint-disable-next-line no-unused-vars -- callback prop types
  readonly onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  // eslint-disable-next-line no-unused-vars -- callback prop types
  readonly onInputChange: (value: string) => void;
  readonly onCancelDelete: () => void;
  readonly onConfirmDelete: () => void;
  // eslint-disable-next-line no-unused-vars -- callback prop types
  readonly onRenameOpenChange: (open: boolean) => void;
  // eslint-disable-next-line no-unused-vars -- callback prop types
  readonly onConfirmRename: (title: string) => void;
  readonly TrailBreadcrumb: ComponentType<{
    readonly trail: readonly DashboardBreadcrumbOverride[] | null;
    readonly isLoadingConversations: boolean;
    readonly isLoadingHistory: boolean;
    readonly activeConversationId: string | undefined;
  }>;
};

export function ChatClientFrame({
  isPage,
  variant,
  chatBreadcrumbTrail,
  isLoadingConversations,
  isLoadingHistory,
  activeConversationId,
  showHistory,
  conversationSearch,
  conversations,
  chatModels,
  selectedIntegrationId,
  canManageChatModels,
  isInputDisabled,
  isMarkingDefault,
  isPending,
  isActiveConversationProcessing,
  showHero,
  showEmptyThread,
  messages,
  error,
  currentUserName,
  currentUserEmail = null,
  currentUserImageUrl,
  currentUserRole = null,
  messagesEndRef,
  pendingAttachments,
  inputValue,
  fileInputRef,
  boundAgentId,
  conversationToDelete,
  conversationToRename,
  isDeleting,
  isRenaming,
  onClose,
  onConversationSearchChange,
  onSelectConversation,
  onNewChat,
  onRenameConversationClick,
  onDeleteConversationClick,
  onToggleHistory,
  onMarkSelectedAsDefault,
  onSelectedIntegrationIdChange,
  onSendMessage,
  onRemoveAttachment,
  onFormSubmit,
  onFileSelect,
  onComposerKeyDown,
  onPaste,
  onInputChange,
  onCancelDelete,
  onConfirmDelete,
  onRenameOpenChange,
  onConfirmRename,
  TrailBreadcrumb,
}: Readonly<ChatClientFrameProps>) {
  const assistantIdentity = useBoundChatAgent(
    isPage ? boundAgentId : undefined
  );
  const [agentsPanelOpen, setAgentsPanelOpen] = useState(false);
  const [agentsPanelAgentId, setAgentsPanelAgentId] = useState<string | null>(
    null
  );

  const openAgentsGallery = () => {
    setAgentsPanelAgentId(null);
    setAgentsPanelOpen(true);
  };

  const openAgentDetail = (agentId: string) => {
    setAgentsPanelAgentId(agentId);
    setAgentsPanelOpen(true);
  };

  return (
    <div
      className={cn(
        'bg-background flex min-h-0 w-full overflow-hidden',
        isPage ? 'h-full min-h-0 flex-1' : 'h-full'
      )}
    >
      {isPage ? (
        <>
          <TrailBreadcrumb
            trail={chatBreadcrumbTrail}
            isLoadingConversations={isLoadingConversations}
            isLoadingHistory={isLoadingHistory}
            activeConversationId={activeConversationId}
          />
          <ChatClientSidebar
            showHistory={showHistory}
            conversationSearch={conversationSearch}
            onConversationSearchChange={onConversationSearchChange}
            isLoadingConversations={isLoadingConversations}
            conversations={conversations}
            activeConversationId={activeConversationId}
            onSelectConversation={onSelectConversation}
            onNewChat={onNewChat}
            onRenameConversationClick={onRenameConversationClick}
            onDeleteConversationClick={onDeleteConversationClick}
          />
        </>
      ) : null}

      <div className="bg-background flex min-w-0 flex-1 flex-col overflow-hidden">
        <ChatFramePanelHeader
          isPage={isPage}
          variant={variant}
          showHistory={showHistory}
          assistantIdentity={assistantIdentity}
          chatModels={chatModels}
          selectedIntegrationId={selectedIntegrationId}
          canManageChatModels={canManageChatModels}
          isInputDisabled={isInputDisabled}
          isMarkingDefault={isMarkingDefault}
          onToggleHistory={onToggleHistory}
          onOpenGallery={openAgentsGallery}
          onOpenDetail={openAgentDetail}
          onNewChat={onNewChat}
          onMarkSelectedAsDefault={onMarkSelectedAsDefault}
          onSelectedIntegrationIdChange={onSelectedIntegrationIdChange}
          onClose={onClose}
        />

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ChatClientMain
            isPage={isPage}
            isLoadingHistory={isLoadingHistory}
            showHero={showHero}
            showEmptyThread={showEmptyThread}
            messages={messages}
            isPending={isPending || isActiveConversationProcessing}
            error={error}
            currentUserName={currentUserName}
            currentUserImageUrl={currentUserImageUrl}
            assistantIdentity={assistantIdentity}
            messagesEndRef={messagesEndRef}
            onSendMessage={onSendMessage}
          />

          <Separator />
          <ChatFrameComposer
            variant={variant}
            pendingAttachments={pendingAttachments}
            inputValue={inputValue}
            isInputDisabled={isInputDisabled}
            fileInputRef={fileInputRef}
            onRemoveAttachment={onRemoveAttachment}
            onFormSubmit={onFormSubmit}
            onFileSelect={onFileSelect}
            onComposerKeyDown={onComposerKeyDown}
            onPaste={onPaste}
            onInputChange={onInputChange}
          />
        </div>
      </div>
      {conversationToDelete ? (
        <RegistryConfirmDialog
          title="Permanently Delete Chat History"
          subject={conversationToDelete.title}
          detail="Warning: This action is irreversible. All messages and executed tool action logs associated with this session will be permanently destroyed."
          confirmLabel="Delete Permanently"
          pendingLabel="Deleting..."
          isPending={isDeleting}
          isSoft={false}
          onCancel={onCancelDelete}
          onConfirm={onConfirmDelete}
        />
      ) : null}
      {conversationToRename ? (
        <ChatRenameDialog
          open
          title={conversationToRename.title}
          isPending={isRenaming}
          onOpenChange={onRenameOpenChange}
          onConfirm={onConfirmRename}
        />
      ) : null}
      {isPage ? (
        <ChatAgentsPanelDialog
          open={agentsPanelOpen}
          onOpenChange={setAgentsPanelOpen}
          initialAgentId={agentsPanelAgentId}
          currentUserName={currentUserName}
          currentUserEmail={currentUserEmail}
          currentUserRole={currentUserRole}
        />
      ) : null}
    </div>
  );
}
