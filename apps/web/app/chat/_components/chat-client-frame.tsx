'use client';

import type {
  ComponentType,
  FormEvent,
  KeyboardEvent,
  ClipboardEvent,
  RefObject,
} from 'react';
import Link from 'next/link';
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
import { buildChatAgentCustomizeHref } from '@/app/chat/_helpers/chat-url';
import { useBoundChatAgent } from '@/app/chat/_helpers/use-bound-chat-agent';
import type { DashboardBreadcrumbOverride } from '@/app/dashboard/_components/dashboard-breadcrumb';

const CHAT_PANEL_HEADER_CLASS =
  'border-border flex h-14 shrink-0 items-center border-b px-3';

type ChatClientFrameProps = {
  readonly isPage: boolean;
  readonly variant: 'page' | 'drawer';
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
  readonly currentUserImageUrl?: string | null;
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
  currentUserImageUrl,
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

  return (
    <div
      className={cn(
        'bg-background flex min-h-0 w-full overflow-hidden',
        isPage ? 'h-full min-h-0 flex-1' : 'h-full'
      )}
    >
      {isPage ? (
        <TrailBreadcrumb
          trail={chatBreadcrumbTrail}
          isLoadingConversations={isLoadingConversations}
          isLoadingHistory={isLoadingHistory}
          activeConversationId={activeConversationId}
        />
      ) : null}
      {isPage ? (
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
      ) : null}

      <div className="bg-background flex min-w-0 flex-1 flex-col overflow-hidden">
        <header
          className={cn(
            CHAT_PANEL_HEADER_CLASS,
            'justify-between gap-3 sm:px-6'
          )}
        >
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {isPage ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onToggleHistory}
                    aria-expanded={showHistory}
                    aria-controls="chat-history-sidebar"
                    aria-label={
                      showHistory ? 'Hide chat history' : 'Show chat history'
                    }
                  >
                    {showHistory ? <PanelLeftClose /> : <PanelLeft />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {showHistory ? 'Hide history' : 'Show history'}
                </TooltipContent>
              </Tooltip>
            ) : null}
            {assistantIdentity ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href={buildChatAgentCustomizeHref(assistantIdentity.id)}
                    className="hover:bg-muted/60 flex min-w-0 items-center gap-2 rounded-lg p-0.5 sm:gap-3"
                    aria-label={`Customize ${assistantIdentity.name}`}
                  >
                    <ChatAgentAvatar
                      name={assistantIdentity.name}
                      kind={assistantIdentity.kind}
                      avatarStyle={assistantIdentity.avatarStyle}
                      avatarSeed={assistantIdentity.avatarSeed}
                      size="sm"
                    />
                    <ChatAssistantNameBlock identity={assistantIdentity} />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="bottom">Customize agent</TooltipContent>
              </Tooltip>
            ) : (
              <>
                <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <Sparkles className="size-4" />
                </div>
                <ChatAssistantNameBlock />
              </>
            )}
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
              onClose={onClose}
            />
          </div>
        </header>

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
          <div className="bg-muted/20 shrink-0 p-3 sm:p-4">
            <div className="mx-auto max-w-3xl">
              <ChatAttachmentTiles
                attachments={pendingAttachments}
                onRemove={onRemoveAttachment}
                disabled={isInputDisabled}
              />
              <form
                onSubmit={onFormSubmit}
                className="flex items-end gap-2 sm:gap-3"
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
                      size="icon-lg"
                      disabled={isInputDisabled}
                      onClick={() => fileInputRef.current?.click()}
                      aria-label="Attach files (JSON, CSV, etc.)"
                    >
                      <Paperclip className="size-5" />
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
                  placeholder="Type your message, attach files, or paste with Ctrl+V…"
                  className="bg-background max-h-40 min-h-10 flex-1 resize-none px-3 py-2.5 sm:px-4"
                />
                <Button
                  type="submit"
                  size="icon-lg"
                  disabled={
                    (!inputValue.trim() && pendingAttachments.length === 0) ||
                    isInputDisabled ||
                    pendingAttachments.some((a) => a.isUploading)
                  }
                  aria-label="Send message"
                >
                  <Send />
                </Button>
              </form>
            </div>
          </div>
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
    </div>
  );
}
