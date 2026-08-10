'use client';

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@repo/ui/lib/utils';
import {
  Send,
  Bot,
  User as UserIcon,
  Loader2,
  Sparkles,
  ChevronRight,
  Trash2,
} from '@repo/ui/lib/icons';
import { useRouter } from 'next/navigation';
import type { ChatMessage } from './chat-client.types';
import { SUGGESTIONS } from './chat-client.data';
import {
  sendChatMessage,
  getChatHistory,
  listConversations,
  deleteConversation,
  type ChatConversation,
} from './chat-client.service';
import { ChatExecutedActionCard } from './chat-executed-action-card';
import { RegistryConfirmDialog } from '@/components/registry-confirm-dialog';

let messageCounter = 0;

interface ChatClientProps {
  readonly variant?: 'page' | 'drawer';
  readonly onClose?: () => void;
}

export function ChatClient({ variant = 'page', onClose }: Readonly<ChatClientProps>) {
  const router = useRouter();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [conversationToDelete, setConversationToDelete] = useState<ChatConversation | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load conversation list and active history on mount
  useEffect(() => {
    async function initChat() {
      try {
        setIsLoadingConversations(true);
        const listResponse = await listConversations();
        if (listResponse.conversations) {
          setConversations(listResponse.conversations);
          
          if (listResponse.conversations.length > 0 && listResponse.conversations[0]) {
            const latestId = listResponse.conversations[0].id;
            setActiveConversationId(latestId);
            setIsLoadingHistory(true);
            const historyResponse = await getChatHistory(latestId);
            if (historyResponse.history) {
              setMessages(historyResponse.history);
            }
          }
        }
      } catch (err) {
        console.error('Failed to initialize chat:', err);
      } finally {
        setIsLoadingConversations(false);
        setIsLoadingHistory(false);
      }
    }
    initChat();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isPending]);

  const handleSelectConversation = async (id: string) => {
    if (id === activeConversationId || isPending) return;
    
    setIsLoadingHistory(true);
    setActiveConversationId(id);
    setError(null);
    try {
      const response = await getChatHistory(id);
      if (response.error) {
        setError(response.error);
      } else if (response.history) {
        setMessages(response.history);
      }
    } catch (err: unknown) {
      console.error('Failed to load conversation:', err);
      setError('Failed to load conversation history.');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleNewChat = () => {
    if (isPending) return;
    setActiveConversationId(undefined);
    setMessages([]);
    setError(null);
  };

  const handleDeleteConversationClick = (e: React.MouseEvent, conv: ChatConversation) => {
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
        setConversations((prev) => prev.filter((c) => c.id !== conversationToDelete.id));
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
      role: 'user',
      content: textToSend,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsPending(true);
    setError(null);

    const history = [...messages, userMessage];

    try {
      const response = await sendChatMessage(history, activeConversationId);

      if (response.error) {
        setError(response.error);
      } else {
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
    handleSendMessage(inputValue);
  };

  const renderSidebarContent = () => {
    if (isLoadingConversations) {
      return (
        <div className="flex justify-center p-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (conversations.length === 0) {
      return (
        <div className="text-center p-4 text-xs text-muted-foreground">
          No past sessions
        </div>
      );
    }

    return conversations.map((conv) => {
      const isActive = conv.id === activeConversationId;
      return (
        <div
          key={conv.id}
          className="group relative flex items-center justify-between rounded-lg overflow-hidden"
        >
          <button
            type="button"
            onClick={() => handleSelectConversation(conv.id)}
            className={`flex-1 text-left px-3 py-2.5 rounded-lg cursor-pointer transition-colors text-xs truncate pr-10 ${
              isActive
                ? 'bg-primary/10 text-primary font-medium'
                : 'hover:bg-muted text-muted-foreground'
            }`}
          >
            <span className="truncate block">{conv.title}</span>
          </button>
          <button
            type="button"
            onClick={(e) => handleDeleteConversationClick(e, conv)}
            className="absolute right-2 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive p-1 rounded transition-all z-10"
            aria-label={`Delete chat session ${conv.title}`}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      );
    });
  };

  return (
    <div
      className={cn(
        'bg-card flex overflow-hidden w-full',
        variant === 'page'
          ? 'border-sidebar-border h-[calc(100vh-140px)] rounded-xl border shadow-sm'
          : 'h-full'
      )}
    >
      {/* Sidebar Panel */}
      {variant === 'page' && (
        <div className="w-64 border-r border-sidebar-border bg-muted/20 flex flex-col shrink-0">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-sidebar-border">
            <button
              type="button"
              onClick={handleNewChat}
              disabled={isPending}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/95 transition-colors disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>New Chat</span>
            </button>
          </div>
          
          {/* Sidebar List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {renderSidebarContent()}
          </div>
        </div>
      )}

      {/* Main Chat Panel */}
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        {/* Header */}
        <div className="border-sidebar-border bg-muted/40 flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-lg">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">AI Assistant</h2>
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                <span>Powered by Google Gemini</span>
              </p>
            </div>
          </div>
          {variant === 'drawer' && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground hover:bg-muted p-1.5 rounded-lg transition-colors"
            >
              <span className="sr-only">Close</span>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Message list / Loading State */}
        {isLoadingHistory ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <Loader2 className="text-primary h-8 w-8 animate-spin" />
            <span className="text-sm text-muted-foreground">Loading chat history...</span>
          </div>
        ) : (
          <div
            className={cn(
              'flex-1 space-y-6 overflow-y-auto',
              variant === 'page' ? 'p-6' : 'p-4'
            )}
          >
            {messages.length === 0 ? (
              <div
                className={cn(
                  'mx-auto flex h-full flex-col items-center justify-center space-y-6 text-center',
                  variant === 'page' ? 'max-w-xl' : 'max-w-xs'
                )}
              >
                <div className="bg-primary/5 text-primary flex h-16 w-16 items-center justify-center rounded-full">
                  <Sparkles className="h-8 w-8 animate-pulse" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold tracking-tight">
                    How can I help you today?
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Ask me to create a project, manage sprints, assign tasks to team
                    members, or handle complete workflow creation conversations.
                  </p>
                </div>

                {/* Suggestions cards */}
                <div className="mt-4 grid w-full grid-cols-1 gap-3">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      type="button"
                      key={suggestion.title}
                      onClick={() => handleSendMessage(suggestion.prompt)}
                      className="border-sidebar-border hover:border-primary/45 hover:bg-muted/30 group flex items-start gap-4 rounded-lg border p-4 text-left transition-all"
                    >
                      <div className="bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors">
                        <suggestion.icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <h4 className="group-hover:text-primary text-sm font-medium transition-colors">
                          {suggestion.title}
                        </h4>
                        <p className="text-muted-foreground line-clamp-1 text-xs">
                          {suggestion.prompt}
                        </p>
                      </div>
                      <ChevronRight className="text-muted-foreground h-4 w-4 self-center transition-transform group-hover:translate-x-0.5" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl space-y-4">
                {messages.map((message) => {
                  const isUser = message.role === 'user';
                  return (
                    <div
                      key={message.id}
                      className={`flex gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      {/* Bot Avatar */}
                      {!isUser && (
                        <div className="bg-primary/10 text-primary border-primary/20 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border">
                          <Bot className="h-4 w-4" />
                        </div>
                      )}

                      {/* Message Bubble */}
                      <div
                        className={`flex max-w-[85%] flex-col gap-2 rounded-lg px-4 py-3 text-sm ${
                          isUser
                            ? 'bg-primary text-primary-foreground rounded-tr-none font-medium'
                            : 'bg-muted border-sidebar-border text-foreground rounded-tl-none border leading-relaxed whitespace-pre-wrap'
                        }`}
                      >
                        <div>{message.content}</div>

                        {/* Action Cards */}
                        {message.actions && message.actions.length > 0 && (
                          <div className="border-sidebar-border/40 mt-3 space-y-2 border-t pt-3">
                            <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                              Executed Actions
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                              {message.actions.map((act) => (
                                <ChatExecutedActionCard
                                  key={`${act.type}-${act.entity.id}`}
                                  action={act}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* User Avatar */}
                      {isUser && (
                        <div className="bg-muted text-muted-foreground border-sidebar-border flex h-8 w-8 shrink-0 items-center justify-center rounded-md border">
                          <UserIcon className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Pending State */}
                {isPending && (
                  <div className="flex justify-start gap-4">
                    <div className="bg-primary/10 text-primary border-primary/20 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="bg-muted border-sidebar-border text-muted-foreground flex items-center gap-2 rounded-lg rounded-tl-none border px-4 py-3 text-sm">
                      <Loader2 className="text-primary h-4 w-4 animate-spin" />
                      <span>Thinking and executing actions...</span>
                    </div>
                  </div>
                )}

                {/* Error Bubble */}
                {error && (
                  <div className="flex justify-start gap-4">
                    <div className="bg-destructive/10 text-destructive border-destructive/20 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="bg-destructive/5 border-destructive/20 text-destructive flex max-w-[85%] flex-col gap-1 rounded-lg rounded-tl-none border px-4 py-3 text-sm">
                      <span className="text-xs font-semibold tracking-wider uppercase">
                        Error Encountered
                      </span>
                      <span>{error}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input Form */}
        <div className="border-sidebar-border bg-muted/20 border-t p-4">
          <form
            onSubmit={handleFormSubmit}
            className="mx-auto flex max-w-3xl gap-3"
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isPending || isLoadingHistory}
              placeholder="Type your message (e.g. create a work item on Beta project)..."
              className="border-sidebar-border bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex-1 rounded-lg border px-4 py-2.5 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isPending || isLoadingHistory}
              className="bg-primary text-primary-foreground ring-offset-background hover:bg-primary/95 focus-visible:ring-ring inline-flex cursor-pointer items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
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
          onConfirm={handleConfirmDelete}
        />
      ) : null}
    </div>
  );
}
