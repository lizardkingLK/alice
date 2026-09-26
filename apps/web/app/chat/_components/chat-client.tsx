'use client';

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { cn } from '@repo/ui/lib/utils';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChatRoles,
  detectChatAttachmentFileType,
  type ChatModelOption,
  type ChatAttachmentWire,
} from '@repo/types';
import { createClient } from '@/lib/supabase/client';
import type { ChatMessage, ActionItem } from './chat-client.types';
import {
  sendChatMessage,
  deleteConversation,
  renameConversation,
  type ChatConversation,
} from '../_services/chat.mutations.client';
import {
  uploadChatAttachment,
  deleteChatAttachment,
} from '../_services/chat-attachments.client';
import type { PendingChatAttachment } from './chat-attachment-tiles';
import {
  revalidateAfterChatActions,
  type ChatMutationActionType,
} from '@/lib/cache/revalidate-after-chat';
import {
  bootstrapLatestChat,
  loadConversationHistory,
} from './chat-client-bootstrap';
import { writeChatHistorySidebarOpenCookie } from '@/app/chat/_helpers/chat-history-sidebar-storage';
import {
  listChatConversationsAction,
  revalidateChatConversations,
} from '../_services/chat.reads.actions.server';
import { ChatConversationEmptyPanel } from '@/app/chat/_components/chat-conversation-empty-panel';
import { ChatClientFrame } from '@/app/chat/_components/chat-client-frame';
import { useWorkspaceChatModels } from '@/app/chat/_components/use-workspace-chat-models';
import { useDashboardTrailBreadcrumb } from '@/app/dashboard/_components/dashboard-breadcrumb-runtime';
import type { DashboardBreadcrumbOverride } from '@/app/dashboard/_components/dashboard-breadcrumb';
import { isAdmin, type AppRole } from '@/lib/rbac';
import { isChatFavoritesReady } from '../_helpers/is-chat-favorites-ready';
import { buildChatHref } from '../_helpers/chat-url';

function ChatPageTrailBreadcrumb({
  trail,
  isLoadingConversations,
  isLoadingHistory,
  activeConversationId,
}: Readonly<{
  trail: readonly DashboardBreadcrumbOverride[] | null;
  isLoadingConversations: boolean;
  isLoadingHistory: boolean;
  activeConversationId: string | undefined;
}>) {
  const searchParams = useSearchParams();
  const favoritesReady = isChatFavoritesReady({
    isLoadingConversations,
    isLoadingHistory,
    activeConversationId,
    urlConversationId: searchParams.get('conversationId'),
  });
  useDashboardTrailBreadcrumb(trail, { favoritesReady });
  return null;
}

function resolveActiveConversationTitle(
  activeConversationId: string | undefined,
  conversations: readonly ChatConversation[]
): string | null {
  if (!activeConversationId) {
    return null;
  }
  return (
    conversations.find((conv) => conv.id === activeConversationId)?.title ??
    null
  );
}

function buildChatBreadcrumbTrail(
  isPage: boolean,
  activeConversationId: string | undefined,
  activeConversationTitle: string | null
): readonly DashboardBreadcrumbOverride[] | null {
  if (!isPage || !activeConversationId || !activeConversationTitle) {
    return null;
  }
  return [
    { label: 'Dashboard', url: '/dashboard' },
    { label: 'Chat', url: '/chat' },
    {
      label: activeConversationTitle,
      url: buildChatHref({
        conversationId: activeConversationId,
      }),
    },
  ];
}

type ChatEmptyGate = 'no-models' | 'no-conversations' | null;

function resolveChatEmptyGate(params: {
  readonly isPage: boolean;
  readonly isLoadingConversations: boolean;
  readonly chatModelCount: number;
  readonly conversationCount: number;
  readonly hasStartedEmptyConversation: boolean;
  readonly activeConversationId: string | undefined;
  readonly messageCount: number;
}): ChatEmptyGate {
  const {
    isPage,
    isLoadingConversations,
    chatModelCount,
    conversationCount,
    hasStartedEmptyConversation,
    activeConversationId,
    messageCount,
  } = params;
  if (!isPage || isLoadingConversations) {
    return null;
  }
  if (chatModelCount === 0) {
    return 'no-models';
  }
  if (
    conversationCount === 0 &&
    !hasStartedEmptyConversation &&
    !activeConversationId &&
    messageCount === 0
  ) {
    return 'no-conversations';
  }
  return null;
}

async function hydrateActiveConversationIfNeeded(params: {
  readonly conversationId: string;
  readonly hydratedRef: React.RefObject<string | null>;
  readonly setIsLoadingHistory: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  readonly setError: React.Dispatch<React.SetStateAction<string | null>>;
}): Promise<void> {
  const {
    conversationId,
    hydratedRef,
    setIsLoadingHistory,
    setMessages,
    setError,
  } = params;
  if (hydratedRef.current === conversationId) {
    return;
  }
  hydratedRef.current = conversationId;
  setIsLoadingHistory(true);
  const result = await loadConversationHistory(conversationId);
  setMessages(result.messages);
  setError(result.error);
  setIsLoadingHistory(false);
}

function useChatConversationsRealtime(params: {
  readonly currentUserId: string | null | undefined;
  readonly activeConversationId: string | undefined;
  readonly hydratedRef: React.RefObject<string | null>;
  readonly setConversations: React.Dispatch<
    React.SetStateAction<ChatConversation[]>
  >;
  readonly setIsLoadingHistory: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  readonly setError: React.Dispatch<React.SetStateAction<string | null>>;
  // eslint-disable-next-line no-unused-vars -- new-chat callback
  readonly onActiveConversationDeleted: (force?: boolean) => void;
}) {
  const {
    currentUserId,
    activeConversationId,
    hydratedRef,
    setConversations,
    setIsLoadingHistory,
    setMessages,
    setError,
    onActiveConversationDeleted,
  } = params;

  const handleRealtimeInsert = useCallback(
    (updatedConv: ChatConversation) => {
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === updatedConv.id);
        return exists ? prev : [updatedConv, ...prev];
      });
    },
    [setConversations]
  );

  const handleRealtimeUpdate = useCallback(
    async (updatedConv: ChatConversation, activeId?: string) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === updatedConv.id ? { ...c, ...updatedConv } : c
        )
      );

      if (updatedConv.id !== activeId || updatedConv.is_processing) {
        return;
      }
      await hydrateActiveConversationIfNeeded({
        conversationId: updatedConv.id,
        hydratedRef,
        setIsLoadingHistory,
        setMessages,
        setError,
      });
    },
    [hydratedRef, setConversations, setError, setIsLoadingHistory, setMessages]
  );

  const handleRealtimeDelete = useCallback(
    (deletedId: string, activeId?: string) => {
      setConversations((prev) => prev.filter((c) => c.id !== deletedId));
      if (activeId === deletedId) {
        onActiveConversationDeleted(true);
      }
    },
    [onActiveConversationDeleted, setConversations]
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
        return;
      }
      if (payload.eventType === 'UPDATE') {
        await handleRealtimeUpdate(
          updatedConv,
          activeConversationId || undefined
        );
        return;
      }
      if (payload.eventType === 'DELETE') {
        const deletedConv = payload.old as { id: string };
        handleRealtimeDelete(deletedConv.id, activeConversationId || undefined);
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
  ]);
}

function useChatProcessingPoll(params: {
  activeConversationId: string | undefined;
  conversations: ChatConversation[];
  hydratedRef: React.RefObject<string | null>;
  setConversations: React.Dispatch<React.SetStateAction<ChatConversation[]>>;
  setIsLoadingHistory: React.Dispatch<React.SetStateAction<boolean>>;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  const {
    activeConversationId,
    conversations,
    hydratedRef,
    setConversations,
    setIsLoadingHistory,
    setMessages,
    setError,
  } = params;

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
          await hydrateActiveConversationIfNeeded({
            conversationId: activeConversationId,
            hydratedRef,
            setIsLoadingHistory,
            setMessages,
            setError,
          });
        }
      } catch (err) {
        console.error('Error polling conversation status:', err);
      }
    }, 500);

    return () => {
      clearInterval(intervalId);
    };
  }, [
    activeConversationId,
    conversations,
    hydratedRef,
    setConversations,
    setIsLoadingHistory,
    setMessages,
    setError,
  ]);
}

function useChatClientBootstrap(params: {
  hasServerBootstrap: boolean;
  activeConversationId: string | undefined;
  initialMessagesLength: number;
  setConversations: React.Dispatch<React.SetStateAction<ChatConversation[]>>;
  setActiveConversationId: React.Dispatch<
    React.SetStateAction<string | undefined>
  >;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setIsLoadingHistory: React.Dispatch<React.SetStateAction<boolean>>;
  setIsLoadingConversations: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  const {
    hasServerBootstrap,
    activeConversationId,
    initialMessagesLength,
    setConversations,
    setActiveConversationId,
    setMessages,
    setIsLoadingHistory,
    setIsLoadingConversations,
    setError,
  } = params;

  useEffect(() => {
    if (!hasServerBootstrap || !activeConversationId) return;
    if (initialMessagesLength > 0) return;

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
  }, [
    hasServerBootstrap,
    activeConversationId,
    initialMessagesLength,
    setIsLoadingHistory,
    setMessages,
    setError,
  ]);

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
  }, [
    hasServerBootstrap,
    setConversations,
    setActiveConversationId,
    setMessages,
    setIsLoadingConversations,
    setIsLoadingHistory,
  ]);
}

let messageCounter = 0;
let attachmentCounter = 0;

const NO_CHAT_MODEL_ERROR =
  'No chat model is configured. Use Add Model to connect one in Settings.';

const inferChatAttachmentFileType = detectChatAttachmentFileType;

async function uploadSelectedChatFiles(params: {
  selectedFiles: FileList | File[];
  activeConversationId: string | undefined;
  setPendingAttachments: React.Dispatch<
    React.SetStateAction<PendingChatAttachment[]>
  >;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const {
    selectedFiles,
    activeConversationId,
    setPendingAttachments,
    setError,
    fileInputRef,
  } = params;
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
      const uploaded = await uploadChatAttachment(file, activeConversationId);
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
  agentId?: string;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setActiveConversationId: React.Dispatch<
    React.SetStateAction<string | undefined>
  >;
  setConversations: React.Dispatch<React.SetStateAction<ChatConversation[]>>;
  hydratedRef: React.RefObject<string | null>;
  router: ChatResponseRouter;
}) {
  const {
    response,
    activeConversationId,
    agentId,
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
    // Keep Next searchParams in sync so favorites / breadcrumbs use the new id.
    router.replace(
      buildChatHref({
        conversationId: response.conversationId,
        agentId,
      })
    );
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
  readonly currentUserEmail?: string | null;
  readonly currentUserImageUrl?: string | null;
  /** SSR bootstrap for `/chat` — skips the mount fetch when provided. */
  readonly initialConversations?: ChatConversation[];
  readonly initialConversationId?: string;
  readonly initialMessages?: ChatMessage[];
  readonly initialChatModels?: ChatModelOption[];
  /** Bound agent from `/chat?agentId=` (page variant). */
  readonly initialAgentId?: string;
  /** SSR cookie preference for the conversation history sidebar. */
  readonly initialHistoryOpen?: boolean;
  readonly currentUserId?: string | null;
  readonly currentUserRole?: AppRole | null;
}

export function ChatClient({
  variant = 'page',
  onClose,
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
      router.replace(buildChatHref({ agentId: boundAgentId }));
      setActiveConversationId(undefined);
      setMessages([]);
      setPendingAttachments([]);
      setError(null);
      setHasStartedEmptyConversation(true);
    },
    [boundAgentId, isConversationBusy, router]
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

    router.replace(
      buildChatHref({
        conversationId: id,
        agentId: boundAgentId,
      })
    );

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
      id: `msg-${Date.now()}-${++messageCounter}`,
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
        attachmentsToSend.length > 0 ? attachmentsToSend : undefined
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
      });
      void revalidateChatConversations();

      if (response.actions && response.actions.length > 0) {
        const mutationActionTypes = response.actions
          .map((action: ActionItem) => action.type)
          .filter(
            (type): type is ChatMutationActionType => type !== 'configure_board'
          );
        await revalidateAfterChatActions(mutationActionTypes);
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
      <div
        className={cn(
          'bg-background flex min-h-0 w-full overflow-hidden',
          isPage ? 'h-full min-h-0 flex-1' : 'h-full'
        )}
      >
        {isPage ? (
          <ChatPageTrailBreadcrumb
            trail={chatBreadcrumbTrail}
            isLoadingConversations={isLoadingConversations}
            isLoadingHistory={isLoadingHistory}
            activeConversationId={activeConversationId}
          />
        ) : null}
        <ChatConversationEmptyPanel
          kind={emptyGate}
          onCreateConversation={
            emptyGate === 'no-conversations'
              ? () => {
                  setHasStartedEmptyConversation(true);
                }
              : undefined
          }
        />
      </div>
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
