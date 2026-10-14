'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatModelOption } from '@repo/types';
import {
  bootstrapChatShell,
  bootstrapLatestChat,
} from '@/app/chat/_components/chat-client-bootstrap';
import type {
  ChatConversation,
  ChatMessage,
} from '@/app/chat/_components/chat-client.types';

export type ChatBootstrapState = {
  readonly isLoading: boolean;
  readonly conversations: ChatConversation[] | null;
  readonly activeConversationId: string | undefined;
  readonly messages: ChatMessage[] | null;
  readonly chatModels: ChatModelOption[] | null;
  readonly ensureLoaded: () => Promise<void>;
};

/**
 * Shared bootstrap for floating drawer (lazy via `ensureLoaded`) and docked
 * panel (auto-load when `enabled`).
 *
 * `preferNewChat` skips hydrating the latest thread so the composer opens empty
 * (Overview Alice widget). Conversations + models still load for send/create.
 */
export function useChatBootstrap(options?: {
  readonly enabled?: boolean;
  readonly logLabel?: string;
  readonly preferNewChat?: boolean;
}): ChatBootstrapState {
  const enabled = options?.enabled ?? false;
  const preferNewChat = options?.preferNewChat ?? false;
  const logLabel = options?.logLabel ?? 'chat bootstrap';
  const logLabelRef = useRef(logLabel);
  logLabelRef.current = logLabel;
  const preferNewChatRef = useRef(preferNewChat);
  preferNewChatRef.current = preferNewChat;

  const [isLoading, setIsLoading] = useState(false);
  const [conversations, setConversations] = useState<ChatConversation[] | null>(
    null
  );
  const [activeConversationId, setActiveConversationId] = useState<
    string | undefined
  >(undefined);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [chatModels, setChatModels] = useState<ChatModelOption[] | null>(null);

  const ensureLoaded = useCallback(async () => {
    if (conversations && chatModels) return;
    if (isLoading) return;

    setIsLoading(true);
    try {
      if (preferNewChatRef.current) {
        const shell = await bootstrapChatShell();
        setConversations(shell.conversations);
        setChatModels(shell.chatModels);
        setActiveConversationId(undefined);
        setMessages([]);
      } else {
        const bootstrap = await bootstrapLatestChat();
        setConversations(bootstrap.conversations);
        setChatModels(bootstrap.chatModels);
        setActiveConversationId(bootstrap.activeConversationId);
        setMessages(bootstrap.messages);
      }
    } catch (err) {
      console.error(`Failed to ${logLabelRef.current}:`, err);
      setConversations([]);
      setActiveConversationId(undefined);
      setMessages([]);
      setChatModels([]);
    } finally {
      setIsLoading(false);
    }
  }, [chatModels, conversations, isLoading]);

  useEffect(() => {
    if (!enabled) return;
    ensureLoaded().catch(() => undefined);
  }, [enabled, ensureLoaded]);

  return {
    isLoading,
    conversations,
    activeConversationId,
    messages,
    chatModels,
    ensureLoaded,
  };
}
