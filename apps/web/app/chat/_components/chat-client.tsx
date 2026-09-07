'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
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
import { useRouter } from 'next/navigation';
import {
  ChatRoles,
  ChatAttachmentFileTypeEnum,
  type ChatModelOption,
  type ChatAttachmentWire,
} from '@repo/types';
import { createClient } from '@/lib/supabase/client';
import type { ChatMessage, ActionItem } from './chat-client.types';
import {
  sendChatMessage,
  deleteConversation,
  type ChatConversation,
} from '../_services/chat.mutations.client';
import {
  uploadChatAttachment,
  deleteChatAttachment,
} from '../_services/chat-attachments.client';
import {
  ChatAttachmentTiles,
  type PendingChatAttachment,
} from './chat-attachment-tiles';
import { revalidateAfterChatActions } from '@/lib/cache/revalidate-after-chat';
import {
  bootstrapLatestChat,
  loadConversationHistory,
} from './chat-client-bootstrap';
import {
  listChatConversationsAction,
  revalidateChatConversations,
} from '../_services/chat.reads.actions.server';
import { RegistryConfirmDialog } from '@/components/registry-confirm-dialog';
import ChatClientSidebar from '@/app/chat/_components/chat-client-sidebar';
import ChatClientHeaderActions from '@/app/chat/_components/chat-client-header-actions';
import ChatClientHeaderLeading from '@/app/chat/_components/chat-client-header-leading';
import ChatClientMain from '@/app/chat/_components/chat-client-main';
import { useWorkspaceChatModels } from '@/app/chat/_components/use-workspace-chat-models';
import { isAdmin, type AppRole } from '@/lib/rbac';

let messageCounter = 0;
let attachmentCounter = 0;

const CHAT_PANEL_HEADER_CLASS =
  'border-border flex h-14 shrink-0 items-center border-b px-4';

const NO_CHAT_MODEL_ERROR =
  'No chat model is configured. Use Add Model to connect one in Settings.';

function inferChatAttachmentFileType(
  fileName: string,
  mimeType: string
): ChatAttachmentFileTypeEnum {
  const normalizedFileName = fileName.toLowerCase();
  const normalizedMimeType = mimeType.toLowerCase();

  if (
    normalizedFileName.endsWith('.json') ||
    normalizedMimeType.includes('application/json')
  ) {
    return ChatAttachmentFileTypeEnum.Json;
  }

  if (
    normalizedFileName.endsWith('.csv') ||
    normalizedMimeType.includes('text/csv') ||
    normalizedMimeType.includes('text/comma-separated-values')
  ) {
    return ChatAttachmentFileTypeEnum.Csv;
  }

  if (
    normalizedFileName.endsWith('.txt') ||
    normalizedFileName.endsWith('.md') ||
    normalizedMimeType.startsWith('text/')
  ) {
    return ChatAttachmentFileTypeEnum.Text;
  }

  if (
    normalizedMimeType.startsWith('image/') ||
    normalizedFileName.endsWith('.png') ||
    normalizedFileName.endsWith('.jpg') ||
    normalizedFileName.endsWith('.jpeg') ||
    normalizedFileName.endsWith('.webp')
  ) {
    return ChatAttachmentFileTypeEnum.Image;
  }

  return ChatAttachmentFileTypeEnum.Other;
}

/* eslint-disable no-unused-vars */
type ChatResponseRouter = { replace: (href: string) => void };
/* eslint-enable no-unused-vars */

function applySuccessfulChatResponse(params: {
  response: {
    history?: ChatMessage[];
    conversationId: string;
    title: string;
    is_processing?: boolean;
    actions?: ActionItem[];
  };
  activeConversationId: string | undefined;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setActiveConversationId: React.Dispatch<
    React.SetStateAction<string | undefined>
  >;
  setConversations: React.Dispatch<React.SetStateAction<ChatConversation[]>>;
  hydratedRef: React.MutableRefObject<string | null>;
  router: ChatResponseRouter;
}) {
  const {
    response,
    activeConversationId,
    setMessages,
    setActiveConversationId,
    setConversations,
    hydratedRef,
    router,
  } = params;

  if (response.history) {
    setMessages(response.history);
  }

  if (!activeConversationId && response.conversationId) {
    if (!response.is_processing) {
      hydratedRef.current = response.conversationId;
    }
    router.replace(`/chat?conversationId=${response.conversationId}`);
    setActiveConversationId(response.conversationId);
    setConversations((prev) => [
      {
        id: response.conversationId,
        title: response.title || 'New Chat',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_processing: response.is_processing ?? false,
      },
      ...prev,
    ]);
    return;
  }

  if (!activeConversationId) {
    return;
  }

  if (!response.is_processing) {
    hydratedRef.current = activeConversationId;
  }

  setConversations((prev) => {
    const others = prev.filter((c) => c.id !== activeConversationId);
    const activeConv = prev.find((c) => c.id === activeConversationId);
    if (!activeConv) {
      return prev;
    }

    return [
      {
        ...activeConv,
        is_processing: response.is_processing ?? true,
      },
      ...others,
    ];
  });
}

interface ChatClientProps {
  readonly variant?: 'page' | 'drawer';
  readonly onClose?: () => void;
  readonly currentUserName?: string | null;
  readonly currentUserImageUrl?: string | null;
  /** SSR bootstrap for `/chat` — skips the mount fetch when provided. */
  readonly initialConversations?: ChatConversation[];
  readonly initialConversationId?: string;
  readonly initialMessages?: ChatMessage[];
  readonly initialChatModels?: ChatModelOption[];
  readonly currentUserId?: string | null;
  readonly currentUserRole?: AppRole | null;
}

export function ChatClient({
  variant = 'page',
  onClose,
  currentUserName,
  currentUserImageUrl,
  initialConversations,
  initialConversationId,
  initialMessages,
  initialChatModels,
  currentUserId,
  currentUserRole,
}: Readonly<ChatClientProps>) {
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
  const [error, setError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(
    () => !hasServerBootstrap
  );
  const [conversationToDelete, setConversationToDelete] =
    useState<ChatConversation | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const [conversationSearch, setConversationSearch] = useState('');
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

  useEffect(() => {
    if (!hasServerBootstrap || !activeConversationId) return;
    if ((initialMessages?.length ?? 0) > 0) return;

    let cancelled = false;

    async function hydrateHistory() {
      const conversationId = activeConversationId;
      if (!conversationId) return;

      setIsLoadingHistory(true);
      setError(null);
      const result = await loadConversationHistory(conversationId);
      if (cancelled) return;
      setError(result.error);
      setMessages(result.messages);
      setIsLoadingHistory(false);
    }

    void hydrateHistory();

    return () => {
      cancelled = true;
    };
  }, [hasServerBootstrap, activeConversationId, initialMessages?.length]);

  useEffect(() => {
    if (hasServerBootstrap) return;

    async function initChat() {
      try {
        setIsLoadingConversations(true);
        const bootstrap = await bootstrapLatestChat();
        setConversations(bootstrap.conversations);
        setActiveConversationId(bootstrap.activeConversationId);
        setMessages(bootstrap.messages);
      } catch (err) {
        console.error('Failed to initialize chat:', err);
      } finally {
        setIsLoadingConversations(false);
        setIsLoadingHistory(false);
      }
    }
    void initChat();
  }, [hasServerBootstrap]);

  const handleRealtimeInsert = useCallback((updatedConv: ChatConversation) => {
    setConversations((prev) => {
      const exists = prev.some((c) => c.id === updatedConv.id);
      return exists ? prev : [updatedConv, ...prev];
    });
  }, []);

  const handleRealtimeUpdate = useCallback(
    async (updatedConv: ChatConversation, activeId?: string) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === updatedConv.id ? { ...c, ...updatedConv } : c
        )
      );

      if (updatedConv.id === activeId && !updatedConv.is_processing) {
        if (hydratedRef.current !== activeId) {
          hydratedRef.current = activeId;
          setIsLoadingHistory(true);
          const result = await loadConversationHistory(updatedConv.id);
          setMessages(result.messages);
          setError(result.error);
          setIsLoadingHistory(false);
        }
      }
    },
    []
  );

  const handleRealtimeDelete = useCallback(
    (
      deletedId: string,
      activeId?: string,
      // eslint-disable-next-line no-unused-vars
      onNewChat?: (force?: boolean) => void
    ) => {
      setConversations((prev) => prev.filter((c) => c.id !== deletedId));
      if (activeId === deletedId && onNewChat) {
        onNewChat(true);
      }
    },
    []
  );

  const handleNewChat = useCallback(
    (force = false) => {
      if (isPending && !force) return;
      router.replace('/chat');
      setActiveConversationId(undefined);
      setMessages([]);
      setPendingAttachments([]);
      setError(null);
    },
    [isPending, router]
  );

  useEffect(() => {
    if (!currentUserId) return;
    const supabase = createClient();

    const handleRealtimeChange = async (payload: {
      eventType: string;
      new: unknown;
      old: unknown;
    }) => {
      const updatedConv = payload.new as ChatConversation;

      if (payload.eventType === 'INSERT') {
        handleRealtimeInsert(updatedConv);
      } else if (payload.eventType === 'UPDATE') {
        await handleRealtimeUpdate(
          updatedConv,
          activeConversationId || undefined
        );
      } else if (payload.eventType === 'DELETE') {
        const deletedConv = payload.old as { id: string };
        handleRealtimeDelete(
          deletedConv.id,
          activeConversationId || undefined,
          handleNewChat
        );
      }
    };

    const channel = supabase
      .channel(`chat_conversations_changes:${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_conversations',
          filter: `user_id=eq.${currentUserId}`,
        },
        handleRealtimeChange
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    currentUserId,
    activeConversationId,
    handleRealtimeInsert,
    handleRealtimeUpdate,
    handleRealtimeDelete,
    handleNewChat,
  ]);

  useEffect(() => {
    if (!activeConversationId) return;

    const isActiveProcessing = conversations.find(
      (c) => c.id === activeConversationId
    )?.is_processing;

    if (!isActiveProcessing) return;

    const intervalId = setInterval(async () => {
      try {
        const latestConversations = await listChatConversationsAction();
        setConversations(latestConversations);

        const currentInLatest = latestConversations.find(
          (c) => c.id === activeConversationId
        );

        if (currentInLatest && !currentInLatest.is_processing) {
          clearInterval(intervalId);
          if (hydratedRef.current !== activeConversationId) {
            hydratedRef.current = activeConversationId;
            setIsLoadingHistory(true);
            const result = await loadConversationHistory(activeConversationId);
            setMessages(result.messages);
            setError(result.error);
            setIsLoadingHistory(false);
          }
        }
      } catch (err) {
        console.error('Error polling conversation status:', err);
      }
    }, 500);

    return () => {
      clearInterval(intervalId);
    };
  }, [activeConversationId, conversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isPending]);

  const handleSelectConversation = async (id: string) => {
    if (isPending) return;
    if (id === activeConversationId && messages.length > 0) return;

    router.replace(`/chat?conversationId=${id}`);

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
    if (isPending) return;
    setConversationToDelete(conv);
  };

  const handleConfirmDelete = async () => {
    if (!conversationToDelete || isPending) return;

    setIsPending(true);
    setError(null);
    try {
      const response = await deleteConversation(conversationToDelete.id);
      if (response.success) {
        await revalidateChatConversations();
        router.refresh();

        setConversations((prev) =>
          prev.filter((c) => c.id !== conversationToDelete.id)
        );

        if (activeConversationId === conversationToDelete.id) {
          handleNewChat(true);
        }
        setConversationToDelete(null);
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
      setError('Failed to delete conversation.');
    } finally {
      setIsPending(false);
    }
  };

  const handleFileSelect = useCallback(
    async (selectedFiles: FileList | File[]) => {
      const fileArray = Array.from(selectedFiles);
      if (fileArray.length === 0) return;

      for (const file of fileArray) {
        const tempId = `temp-${Date.now()}-${++attachmentCounter}`;
        const optimisticAttachment: PendingChatAttachment = {
          id: tempId,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
          storagePath: '',
          url: '',
          fileType: inferChatAttachmentFileType(file.name, file.type || ''),
          isUploading: true,
        };

        setPendingAttachments((prev) => [...prev, optimisticAttachment]);

        try {
          const uploaded = await uploadChatAttachment(
            file,
            activeConversationId
          );
          setPendingAttachments((prev) => {
            const stillPresent = prev.some((item) => item.id === tempId);
            if (!stillPresent) {
              void deleteChatAttachment(uploaded.id);
              return prev;
            }
            return prev.map((item) =>
              item.id === tempId ? { ...uploaded, isUploading: false } : item
            );
          });
        } catch (uploadError) {
          console.error('Failed to upload chat attachment:', uploadError);
          setPendingAttachments((prev) =>
            prev.filter((item) => item.id !== tempId)
          );
          setError(
            `Failed to upload ${file.name}: ${uploadError instanceof Error ? uploadError.message : 'Upload failed'}`
          );
        }
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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
      }));

    const messageContent =
      trimmedText ||
      (attachmentsToSend.length > 0
        ? `Please process the attached document(s): ${attachmentsToSend.map((a) => a.fileName).join(', ')}`
        : '');

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-${++messageCounter}`,
      role: ChatRoles.User,
      content: messageContent,
      attachments:
        attachmentsToSend.length > 0 ? attachmentsToSend : undefined,
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
        attachmentsToSend.length > 0 ? attachmentsToSend : undefined
      );

      applySuccessfulChatResponse({
        response,
        activeConversationId,
        setMessages,
        setActiveConversationId,
        setConversations,
        hydratedRef,
        router,
      });

      if (response.actions && response.actions.length > 0) {
        await revalidateAfterChatActions(
          response.actions.map((action: ActionItem) => action.type)
        );
        router.refresh();
      }
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
  const showHero = !activeConversationId && messages.length === 0 && !isPending;
  const showEmptyThread =
    Boolean(activeConversationId) &&
    messages.length === 0 &&
    !isLoadingHistory &&
    !isPending;

  return (
    <div
      className={cn(
        'bg-background flex min-h-0 w-full overflow-hidden',
        isPage ? 'h-full min-h-0 flex-1' : 'h-full'
      )}
    >
      {isPage ? (
        <ChatClientSidebar
          showHistory={showHistory}
          conversationSearch={conversationSearch}
          onConversationSearchChange={setConversationSearch}
          isLoadingConversations={isLoadingConversations}
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={(id) => {
            void handleSelectConversation(id);
          }}
          onNewChat={handleNewChat}
          onDeleteConversationClick={handleDeleteConversationClick}
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
                    onClick={() => setIsHistoryOpen((open) => !open)}
                    aria-expanded={isHistoryOpen}
                    aria-controls="chat-history-sidebar"
                    aria-label={
                      isHistoryOpen ? 'Hide chat history' : 'Show chat history'
                    }
                  >
                    {isHistoryOpen ? <PanelLeftClose /> : <PanelLeft />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {isHistoryOpen ? 'Hide history' : 'Show history'}
                </TooltipContent>
              </Tooltip>
            ) : null}
            <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
              <Sparkles className="size-4" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold">Alice</h2>
            </div>
            <ChatClientHeaderLeading
              chatModels={chatModels}
              selectedIntegrationId={selectedIntegrationId}
              canManageChatModels={canManageChatModels}
              isPending={isInputDisabled}
              isMarkingDefault={isMarkingDefault}
              onMarkSelectedAsDefault={markSelectedAsDefault}
            />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <ChatClientHeaderActions
              variant={variant}
              isPending={isInputDisabled}
              chatModels={chatModels}
              selectedIntegrationId={selectedIntegrationId}
              onSelectedIntegrationIdChange={setSelectedIntegrationId}
              onNewChat={handleNewChat}
              onClose={onClose}
            />
          </div>
        </header>

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
          messagesEndRef={messagesEndRef}
          onSendMessage={(text) => {
            void handleSendMessage(text);
          }}
        />

        <Separator />
        <div className="bg-muted/20 shrink-0 p-3 sm:p-4">
          <div className="mx-auto max-w-3xl">
            <ChatAttachmentTiles
              attachments={pendingAttachments}
              onRemove={handleRemoveAttachment}
              disabled={isInputDisabled}
            />
            <form
              onSubmit={handleFormSubmit}
              className="flex items-end gap-2 sm:gap-3"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    void handleFileSelect(e.target.files);
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
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleComposerKeyDown}
                onPaste={handlePaste}
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
      {conversationToDelete ? (
        <RegistryConfirmDialog
          title="Permanently Delete Chat History"
          subject={conversationToDelete.title}
          detail="Warning: This action is irreversible. All messages and executed tool action logs associated with this session will be permanently destroyed."
          confirmLabel="Delete Permanently"
          pendingLabel="Deleting..."
          isPending={isPending}
          isSoft={false}
          onCancel={() => setConversationToDelete(null)}
          onConfirm={() => {
            void handleConfirmDelete();
          }}
        />
      ) : null}
    </div>
  );
}
