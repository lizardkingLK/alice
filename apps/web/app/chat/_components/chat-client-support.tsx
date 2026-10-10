'use client';

import { type Dispatch, type RefObject, type SetStateAction } from 'react';
import { useSearchParams } from 'next/navigation';
import { cn } from '@repo/ui/lib/utils';
import { detectChatAttachmentFileType } from '@repo/types';
import type { ChatMessage, ActionItem } from './chat-client.types';
import type { ChatConversation } from '../_services/chat.mutations.client';
import {
  uploadChatAttachment,
  deleteChatAttachment,
} from '../_services/chat-attachments.client';
import type { PendingChatAttachment } from './chat-attachment-tiles';
import { ChatConversationEmptyPanel } from '@/app/chat/_components/chat-conversation-empty-panel';
import { useDashboardTrailBreadcrumb } from '@/app/dashboard/_components/dashboard-breadcrumb-runtime';
import type { DashboardBreadcrumbOverride } from '@/app/dashboard/_components/dashboard-breadcrumb';
import { isChatFavoritesReady } from '../_helpers/is-chat-favorites-ready';
import { buildChatHref } from '../_helpers/chat-url';
import {
  revalidateAfterChatActions,
  type ChatMutationActionType,
} from '@/lib/cache/revalidate-after-chat';

export function ChatPageTrailBreadcrumb({
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

export function resolveActiveConversationTitle(
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

export function buildChatBreadcrumbTrail(
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

export type ChatEmptyGate = 'no-models' | 'no-conversations' | null;

export function resolveChatEmptyGate(params: {
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

export function ChatEmptyGateView({
  isPage,
  emptyGate,
  chatBreadcrumbTrail,
  isLoadingConversations,
  isLoadingHistory,
  activeConversationId,
  onCreateConversation,
}: Readonly<{
  isPage: boolean;
  emptyGate: Exclude<ChatEmptyGate, null>;
  chatBreadcrumbTrail: readonly DashboardBreadcrumbOverride[] | null;
  isLoadingConversations: boolean;
  isLoadingHistory: boolean;
  activeConversationId: string | undefined;
  onCreateConversation?: () => void;
}>) {
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
          emptyGate === 'no-conversations' ? onCreateConversation : undefined
        }
      />
    </div>
  );
}

let messageCounter = 0;
let attachmentCounter = 0;

export const NO_CHAT_MODEL_ERROR =
  'No chat model is configured. Use Add Model to connect one in Settings.';

const inferChatAttachmentFileType = detectChatAttachmentFileType;

export function nextChatMessageId(): string {
  return `msg-${Date.now()}-${++messageCounter}`;
}

export async function uploadSelectedChatFiles(params: {
  selectedFiles: FileList | File[];
  activeConversationId: string | undefined;
  setPendingAttachments: Dispatch<SetStateAction<PendingChatAttachment[]>>;
  setError: Dispatch<SetStateAction<string | null>>;
  fileInputRef: RefObject<HTMLInputElement | null>;
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

export function applySuccessfulChatResponse(params: {
  response: {
    history?: ChatMessage[];
    conversationId: string;
    title: string;
    is_processing?: boolean;
    actions?: ActionItem[];
  };
  activeConversationId: string | undefined;
  agentId?: string;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setActiveConversationId: Dispatch<SetStateAction<string | undefined>>;
  setConversations: Dispatch<SetStateAction<ChatConversation[]>>;
  hydratedRef: RefObject<string | null>;
  router: ChatResponseRouter;
  /** When false (docked Alice), stay on the current page URL. */
  readonly syncUrl?: boolean;
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
    syncUrl = true,
  } = params;

  if (response.history) {
    setMessages(response.history);
  }

  if (!activeConversationId && response.conversationId) {
    if (!response.is_processing) {
      hydratedRef.current = response.conversationId;
    }
    // Full-page chat keeps searchParams in sync for favorites / breadcrumbs.
    if (syncUrl) {
      router.replace(
        buildChatHref({
          conversationId: response.conversationId,
          agentId,
        })
      );
    }
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

/* eslint-disable no-unused-vars -- callback param names document the API */
export async function syncChatMutationSideEffects(params: {
  readonly actions: readonly ActionItem[] | undefined;
  readonly dismissProject: (projectId: string) => void;
  readonly router: { refresh: () => void };
}): Promise<void> {
  /* eslint-enable no-unused-vars */
  const { actions, dismissProject, router } = params;
  if (!actions || actions.length === 0) {
    return;
  }

  for (const action of actions) {
    if (action.type === 'dismiss_workflow_patch') {
      dismissProject(action.entity.projectId);
    }
  }

  const mutationActionTypes = actions
    .map((action) => action.type)
    .filter(
      (type): type is ChatMutationActionType =>
        type !== 'configure_board' &&
        type !== 'propose_workflow_patch' &&
        type !== 'dismiss_workflow_patch'
    );

  await revalidateAfterChatActions(mutationActionTypes);
  router.refresh();
}
