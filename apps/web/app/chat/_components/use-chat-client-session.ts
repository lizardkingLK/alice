'use client';

import {
  useCallback,
  useEffect,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';
import { createClient } from '@/lib/supabase/client';
import type { ChatMessage } from './chat-client.types';
import type { ChatConversation } from '../_services/chat.mutations.client';
import {
  bootstrapLatestChat,
  loadConversationHistory,
} from './chat-client-bootstrap';
import { listChatConversationsAction } from '../_services/chat.reads.actions.server';

export async function hydrateActiveConversationIfNeeded(params: {
  readonly conversationId: string;
  readonly hydratedRef: RefObject<string | null>;
  readonly setIsLoadingHistory: Dispatch<SetStateAction<boolean>>;
  readonly setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  readonly setError: Dispatch<SetStateAction<string | null>>;
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

export function useChatConversationsRealtime(params: {
  readonly currentUserId: string | null | undefined;
  readonly activeConversationId: string | undefined;
  readonly hydratedRef: RefObject<string | null>;
  readonly setConversations: Dispatch<SetStateAction<ChatConversation[]>>;
  readonly setIsLoadingHistory: Dispatch<SetStateAction<boolean>>;
  readonly setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  readonly setError: Dispatch<SetStateAction<string | null>>;
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

export function useChatProcessingPoll(params: {
  activeConversationId: string | undefined;
  conversations: ChatConversation[];
  hydratedRef: RefObject<string | null>;
  setConversations: Dispatch<SetStateAction<ChatConversation[]>>;
  setIsLoadingHistory: Dispatch<SetStateAction<boolean>>;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setError: Dispatch<SetStateAction<string | null>>;
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

export function useChatClientBootstrap(params: {
  hasServerBootstrap: boolean;
  activeConversationId: string | undefined;
  initialMessagesLength: number;
  setConversations: Dispatch<SetStateAction<ChatConversation[]>>;
  setActiveConversationId: Dispatch<SetStateAction<string | undefined>>;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  setIsLoadingHistory: Dispatch<SetStateAction<boolean>>;
  setIsLoadingConversations: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
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
