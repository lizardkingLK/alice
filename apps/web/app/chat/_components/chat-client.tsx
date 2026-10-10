'use client';

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { useRouter } from 'next/navigation';
import { ChatRoles, type ChatAttachmentWire } from '@repo/types';
import type { ChatMessage, ChatClientProps } from './chat-client.types';
import {
  sendChatMessage,
  deleteConversation,
  renameConversation,
  type ChatConversation,
} from '../_services/chat.mutations.client';
import { deleteChatAttachment } from '../_services/chat-attachments.client';
import type { PendingChatAttachment } from './chat-attachment-tiles';
import { loadConversationHistory } from './chat-client-bootstrap';
import { writeChatHistorySidebarOpenCookie } from '@/app/chat/_helpers/chat-history-sidebar-storage';
import { revalidateChatConversations } from '../_services/chat.reads.actions.server';
import { ChatClientFrame } from '@/app/chat/_components/chat-client-frame';
import { useWorkspaceChatModels } from '@/app/chat/_components/use-workspace-chat-models';
import {
  useWorkflowProposalDismiss,
  WorkflowProposalDismissProvider,
} from '@/app/chat/_components/workflow-proposal-dismiss-context';
import { isAdmin } from '@/lib/rbac';
import { buildChatHref } from '../_helpers/chat-url';
import {
  useChatClientBootstrap,
  useChatConversationsRealtime,
  useChatProcessingPoll,
} from './use-chat-client-session';
import {
  ChatEmptyGateView,
  ChatPageTrailBreadcrumb,
  NO_CHAT_MODEL_ERROR,
  applySuccessfulChatResponse,
  buildChatBreadcrumbTrail,
  nextChatMessageId,
  resolveActiveConversationTitle,
  resolveChatEmptyGate,
  uploadSelectedChatFiles,
  syncChatMutationSideEffects,
} from './chat-client-support';

export function ChatClient(props: Readonly<ChatClientProps>) {
  return (
    <WorkflowProposalDismissProvider>
      <ChatClientInner {...props} />
    </WorkflowProposalDismissProvider>
  );
}

function ChatClientInner({
  variant = 'page',
  onClose,
  viewContext = null,
  currentUserName,
  currentUserEmail = null,
  currentUserImageUrl,
  initialConversations,
  initialConversationId,
  initialMessages,
  initialChatModels,
  initialAgentId,
  initialHistoryOpen = true,
  currentUserId,
  currentUserRole,
}: Readonly<ChatClientProps>) {
  const { dismissProject } = useWorkflowProposalDismiss();
  const router = useRouter();
  const isPage = variant === 'page';
  const canManageChatModels = isAdmin(currentUserRole);
  const hasServerBootstrap = initialConversations !== undefined;
  const [conversations, setConversations] = useState<ChatConversation[]>(
    () => initialConversations ?? []
  );
  const [activeConversationId, setActiveConversationId] = useState<
    string | undefined
  >(() => initialConversationId);
  const [messages, setMessages] = useState<ChatMessage[]>(
    () => initialMessages ?? []
  );
  const [inputValue, setInputValue] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<
    PendingChatAttachment[]
  >([]);
  const [isPending, setIsPending] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(
    () => !hasServerBootstrap
  );
  const [conversationToDelete, setConversationToDelete] =
    useState<ChatConversation | null>(null);
  const [conversationToRename, setConversationToRename] =
    useState<ChatConversation | null>(null);
  const isConversationBusy = isPending || isRenaming || isDeleting;
  const [isHistoryOpen, setIsHistoryOpen] = useState(initialHistoryOpen);
  const [conversationSearch, setConversationSearch] = useState('');

  const handleToggleHistory = useCallback(() => {
    setIsHistoryOpen((open) => {
      const next = !open;
      writeChatHistorySidebarOpenCookie(next);
      return next;
    });
  }, []);
  const [hasStartedEmptyConversation, setHasStartedEmptyConversation] =
    useState(Boolean(initialAgentId));
  const [boundAgentId] = useState<string | undefined>(initialAgentId);
  const {
    chatModels,
    selectedIntegrationId,
    setSelectedIntegrationId,
    isMarkingDefault,
    markSelectedAsDefault,
  } = useWorkspaceChatModels(initialChatModels);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hydratedRef = useRef<string | null>(null);

  useChatClientBootstrap({
    hasServerBootstrap,
    activeConversationId,
    initialMessagesLength: initialMessages?.length ?? 0,
    setConversations,
    setActiveConversationId,
    setMessages,
    setIsLoadingHistory,
    setIsLoadingConversations,
    setError,
  });

  const handleNewChat = useCallback(
    (force = false) => {
      if (isConversationBusy && !force) return;
      // Full-page chat syncs the URL; docked Alice stays on the current page.
      if (isPage) {
        router.replace(buildChatHref({ agentId: boundAgentId }));
      }
      setActiveConversationId(undefined);
      setMessages([]);
      setPendingAttachments([]);
      setError(null);
      setHasStartedEmptyConversation(true);
    },
    [boundAgentId, isConversationBusy, isPage, router]
  );

  useChatConversationsRealtime({
    currentUserId,
    activeConversationId,
    hydratedRef,
    setConversations,
    setIsLoadingHistory,
    setMessages,
    setError,
    onActiveConversationDeleted: handleNewChat,
  });

  useChatProcessingPoll({
    activeConversationId,
    conversations,
    hydratedRef,
    setConversations,
    setIsLoadingHistory,
    setMessages,
    setError,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isPending]);

  const handleSelectConversation = async (id: string) => {
    if (isConversationBusy) return;
    if (id === activeConversationId && messages.length > 0) return;

    if (isPage) {
      router.replace(
        buildChatHref({
          conversationId: id,
          agentId: boundAgentId,
        })
      );
    }

    setIsLoadingHistory(true);
    setActiveConversationId(id);
    setError(null);
    const result = await loadConversationHistory(id);
    setError(result.error);
    setMessages(result.messages);
    setIsLoadingHistory(false);
  };

  const handleDeleteConversationClick = (
    e: React.MouseEvent,
    conv: ChatConversation
  ) => {
    e.stopPropagation();
    if (isConversationBusy) return;
    setConversationToDelete(conv);
  };

  const handleRenameConversationClick = (
    e: React.MouseEvent,
    conv: ChatConversation
  ) => {
    e.stopPropagation();
    if (isConversationBusy) return;
    setConversationToRename(conv);
  };

  const handleConfirmRename = async (title: string) => {
    if (!conversationToRename || isRenaming) return;

    setIsRenaming(true);
    setError(null);
    try {
      const renamed = await renameConversation(conversationToRename.id, title);
      await revalidateChatConversations();
      router.refresh();
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === renamed.id
            ? {
                ...conv,
                title: renamed.title,
                updated_at: renamed.updated_at,
              }
            : conv
        )
      );
      setConversationToRename(null);
    } catch (err) {
      console.error('Failed to rename conversation:', err);
      setError('Failed to rename conversation.');
    } finally {
      setIsRenaming(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!conversationToDelete || isDeleting) return;

    setIsDeleting(true);
    setError(null);
    try {
      const response = await deleteConversation(conversationToDelete.id);
      if (!response.success) {
        return;
      }
      await revalidateChatConversations();
      router.refresh();

      setConversations((prev) =>
        prev.filter((c) => c.id !== conversationToDelete.id)
      );

      if (activeConversationId === conversationToDelete.id) {
        handleNewChat(true);
      }
      setConversationToDelete(null);
    } catch (err) {
      console.error('Failed to delete conversation:', err);
      setError('Failed to delete conversation.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFileSelect = useCallback(
    async (selectedFiles: FileList | File[]) => {
      await uploadSelectedChatFiles({
        selectedFiles,
        activeConversationId,
        setPendingAttachments,
        setError,
        fileInputRef,
      });
    },
    [activeConversationId]
  );

  const handleRemoveAttachment = useCallback(async (attachmentId: string) => {
    setPendingAttachments((prev) =>
      prev.filter((item) => item.id !== attachmentId)
    );
    if (!attachmentId.startsWith('temp-')) {
      try {
        await deleteChatAttachment(attachmentId);
      } catch (err) {
        console.error('Failed to delete chat attachment:', err);
      }
    }
  }, []);

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      e.preventDefault();
      void handleFileSelect(e.clipboardData.files);
    }
  };

  const handleSendMessage = async (textToSend: string) => {
    const trimmedText = textToSend.trim();
    const isUploadingAny = pendingAttachments.some((a) => a.isUploading);
    if (
      (!trimmedText && pendingAttachments.length === 0) ||
      isPending ||
      isUploadingAny
    ) {
      return;
    }

    if (!selectedIntegrationId) {
      setError(NO_CHAT_MODEL_ERROR);
      return;
    }

    const attachmentsToSend: ChatAttachmentWire[] = pendingAttachments
      .filter((a) => !a.isUploading)
      .map((a) => ({
        id: a.id,
        fileName: a.fileName,
        fileSize: a.fileSize,
        mimeType: a.mimeType,
        storagePath: a.storagePath,
        url: a.url,
        fileType: a.fileType,
        expiresAt: a.expiresAt,
      }));

    const messageContent =
      trimmedText ||
      (attachmentsToSend.length > 0
        ? `Please process the attached document(s): ${attachmentsToSend.map((a) => a.fileName).join(', ')}`
        : '');

    const userMessage: ChatMessage = {
      id: nextChatMessageId(),
      role: ChatRoles.User,
      content: messageContent,
      attachments: attachmentsToSend.length > 0 ? attachmentsToSend : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setPendingAttachments([]);
    setIsPending(true);
    hydratedRef.current = null;
    setError(null);

    const history = [...messages, userMessage];

    try {
      const response = await sendChatMessage(
        history,
        activeConversationId,
        selectedIntegrationId,
        attachmentsToSend.length > 0 ? attachmentsToSend : undefined,
        viewContext
      );

      applySuccessfulChatResponse({
        response,
        activeConversationId,
        agentId: boundAgentId,
        setMessages,
        setActiveConversationId,
        setConversations,
        hydratedRef,
        router,
        syncUrl: isPage,
      });
      void revalidateChatConversations();

      await syncChatMutationSideEffects({
        actions: response.actions,
        dismissProject,
        router,
      });
    } catch (err: unknown) {
      console.error('Chat error:', err);
      const message =
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again. If this keeps happening, contact your administrator.';
      setError(message);
    } finally {
      setIsPending(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handleSendMessage(inputValue);
  };

  const isActiveConversationProcessing = Boolean(
    conversations.find((c) => c.id === activeConversationId)?.is_processing
  );
  const isInputDisabled =
    isPending || isLoadingHistory || isActiveConversationProcessing;

  const handleComposerKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    e.preventDefault();
    const canSend =
      (Boolean(inputValue.trim()) || pendingAttachments.length > 0) &&
      !isInputDisabled &&
      !pendingAttachments.some((a) => a.isUploading);
    if (!canSend) return;
    void handleSendMessage(inputValue);
  };

  const showHistory = isPage && isHistoryOpen;

  const activeConversationTitle = useMemo(
    () => resolveActiveConversationTitle(activeConversationId, conversations),
    [activeConversationId, conversations]
  );

  const chatBreadcrumbTrail = useMemo(
    () =>
      buildChatBreadcrumbTrail(
        isPage,
        activeConversationId,
        activeConversationTitle
      ),
    [activeConversationId, activeConversationTitle, isPage]
  );

  const showHero = !activeConversationId && messages.length === 0 && !isPending;
  const showEmptyThread =
    Boolean(activeConversationId) &&
    messages.length === 0 &&
    !isLoadingHistory &&
    !isPending;
  const emptyGate = resolveChatEmptyGate({
    isPage,
    isLoadingConversations,
    chatModelCount: chatModels.length,
    conversationCount: conversations.length,
    hasStartedEmptyConversation,
    activeConversationId,
    messageCount: messages.length,
  });

  if (emptyGate) {
    return (
      <ChatEmptyGateView
        isPage={isPage}
        emptyGate={emptyGate}
        chatBreadcrumbTrail={chatBreadcrumbTrail}
        isLoadingConversations={isLoadingConversations}
        isLoadingHistory={isLoadingHistory}
        activeConversationId={activeConversationId}
        onCreateConversation={() => {
          setHasStartedEmptyConversation(true);
        }}
      />
    );
  }

  return (
    <ChatClientFrame
      isPage={isPage}
      variant={variant}
      chatBreadcrumbTrail={chatBreadcrumbTrail}
      isLoadingConversations={isLoadingConversations}
      isLoadingHistory={isLoadingHistory}
      activeConversationId={activeConversationId}
      showHistory={showHistory}
      conversationSearch={conversationSearch}
      conversations={conversations}
      chatModels={chatModels}
      selectedIntegrationId={selectedIntegrationId}
      canManageChatModels={canManageChatModels}
      isInputDisabled={isInputDisabled}
      isMarkingDefault={isMarkingDefault}
      isPending={isPending}
      isActiveConversationProcessing={isActiveConversationProcessing}
      showHero={showHero}
      showEmptyThread={showEmptyThread}
      messages={messages}
      error={error}
      currentUserName={currentUserName}
      currentUserEmail={currentUserEmail}
      currentUserImageUrl={currentUserImageUrl}
      currentUserRole={currentUserRole}
      messagesEndRef={messagesEndRef}
      pendingAttachments={pendingAttachments}
      inputValue={inputValue}
      fileInputRef={fileInputRef}
      boundAgentId={boundAgentId}
      conversationToDelete={conversationToDelete}
      conversationToRename={conversationToRename}
      isDeleting={isDeleting}
      isRenaming={isRenaming}
      onClose={onClose}
      onConversationSearchChange={setConversationSearch}
      onSelectConversation={(id) => {
        void handleSelectConversation(id);
      }}
      onNewChat={handleNewChat}
      onRenameConversationClick={handleRenameConversationClick}
      onDeleteConversationClick={handleDeleteConversationClick}
      onToggleHistory={handleToggleHistory}
      onMarkSelectedAsDefault={markSelectedAsDefault}
      onSelectedIntegrationIdChange={setSelectedIntegrationId}
      onSendMessage={(text) => {
        void handleSendMessage(text);
      }}
      onRemoveAttachment={handleRemoveAttachment}
      onFormSubmit={handleFormSubmit}
      onFileSelect={(files) => {
        void handleFileSelect(files);
      }}
      onComposerKeyDown={handleComposerKeyDown}
      onPaste={handlePaste}
      onInputChange={setInputValue}
      onCancelDelete={() => setConversationToDelete(null)}
      onConfirmDelete={() => {
        void handleConfirmDelete();
      }}
      onRenameOpenChange={(open) => {
        if (!open && !isRenaming) {
          setConversationToRename(null);
        }
      }}
      onConfirmRename={(nextTitle) => {
        void handleConfirmRename(nextTitle);
      }}
      TrailBreadcrumb={ChatPageTrailBreadcrumb}
    />
  );
}
