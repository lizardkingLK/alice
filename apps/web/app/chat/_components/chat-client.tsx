'use client';

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@repo/ui/lib/utils';
import { Textarea } from '@repo/ui/components/ui/textarea';
import { Button } from '@repo/ui/components/ui/button';
import { Separator } from '@repo/ui/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import { Send, Sparkles, PanelLeft, PanelLeftClose } from '@repo/ui/lib/icons';
import { useRouter } from 'next/navigation';
import {
  ChatRoles,
  DEFAULT_CHAT_MODEL_VALUE,
  type ChatModelValue,
} from '@repo/types';
import type { ChatMessage } from './chat-client.types';
import {
  sendChatMessage,
  deleteConversation,
  type ChatConversation,
} from './chat-client.service';
import {
  bootstrapLatestChat,
  loadConversationHistory,
} from './chat-client-bootstrap';
import { RegistryConfirmDialog } from '@/components/registry-confirm-dialog';
import ChatClientSidebar from '@/app/chat/_components/chat-client-sidebar';
import ChatClientHeaderActions from '@/app/chat/_components/chat-client-header-actions';
import ChatClientMain from '@/app/chat/_components/chat-client-main';

let messageCounter = 0;

const CHAT_PANEL_HEADER_CLASS =
  'border-border flex h-14 shrink-0 items-center border-b px-4';

interface ChatClientProps {
  readonly variant?: 'page' | 'drawer';
  readonly onClose?: () => void;
  readonly currentUserName?: string | null;
  readonly currentUserImageUrl?: string | null;
  /** SSR bootstrap for `/chat` — skips the mount fetch when provided. */
  readonly initialConversations?: ChatConversation[];
  readonly initialConversationId?: string;
  readonly initialMessages?: ChatMessage[];
}

export function ChatClient({
  variant = 'page',
  onClose,
  currentUserName,
  currentUserImageUrl,
  initialConversations,
  initialConversationId,
  initialMessages,
}: Readonly<ChatClientProps>) {
  const router = useRouter();
  const isPage = variant === 'page';
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
  const [selectedModelId, setSelectedModelId] = useState<ChatModelValue>(
    () => DEFAULT_CHAT_MODEL_VALUE
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isPending]);

  const handleSelectConversation = async (id: string) => {
    if (isPending) return;
    if (id === activeConversationId && messages.length > 0) return;

    setIsLoadingHistory(true);
    setActiveConversationId(id);
    setError(null);
    const result = await loadConversationHistory(id);
    setError(result.error);
    setMessages(result.messages);
    setIsLoadingHistory(false);
  };

  const handleNewChat = () => {
    if (isPending) return;
    setActiveConversationId(undefined);
    setMessages([]);
    setError(null);
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
        setConversations((prev) =>
          prev.filter((c) => c.id !== conversationToDelete.id)
        );
        if (activeConversationId === conversationToDelete.id) {
          handleNewChat();
        }
        setConversationToDelete(null);
      } else if (response.error) {
        setError(response.error);
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
      setError('Failed to delete conversation.');
    } finally {
      setIsPending(false);
    }
  };

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isPending) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-${++messageCounter}`,
      role: ChatRoles.User,
      content: textToSend,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsPending(true);
    setError(null);

    const history = [...messages, userMessage];

    try {
      const response = await sendChatMessage(
        history,
        activeConversationId,
        selectedModelId
      );

      if (response.error) {
        setError(response.error);
        return;
      }

      if (response.history) {
        setMessages(response.history);
      }

      if (!activeConversationId && response.conversationId) {
        setActiveConversationId(response.conversationId);
        setConversations((prev) => [
          {
            id: response.conversationId,
            title: response.title || 'New Chat',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          ...prev,
        ]);
      } else if (activeConversationId) {
        setConversations((prev) => {
          const activeConv = prev.find((c) => c.id === activeConversationId);
          const others = prev.filter((c) => c.id !== activeConversationId);
          if (activeConv) {
            return [activeConv, ...others];
          }
          return prev;
        });
      }

      if (response.actions && response.actions.length > 0) {
        router.refresh();
      }
    } catch (err: unknown) {
      console.error('Chat error:', err);
      const message =
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please check if backend API and GEMINI_API_KEY are configured.';
      setError(message);
    } finally {
      setIsPending(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handleSendMessage(inputValue);
  };

  const handleComposerKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    e.preventDefault();
    if (!inputValue.trim() || isPending || isLoadingHistory) return;
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
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <ChatClientHeaderActions
              variant={variant}
              isPending={isPending}
              selectedModelId={selectedModelId}
              onSelectedModelIdChange={setSelectedModelId}
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
          isPending={isPending}
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
          <form
            onSubmit={handleFormSubmit}
            className="mx-auto flex max-w-3xl items-end gap-2 sm:gap-3"
          >
            <Textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleComposerKeyDown}
              disabled={isPending || isLoadingHistory}
              rows={1}
              placeholder="Type your message…"
              className="bg-background max-h-40 min-h-10 flex-1 resize-none px-3 py-2.5 sm:px-4"
            />
            <Button
              type="submit"
              size="icon-lg"
              disabled={!inputValue.trim() || isPending || isLoadingHistory}
              aria-label="Send message"
            >
              <Send />
            </Button>
          </form>
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
