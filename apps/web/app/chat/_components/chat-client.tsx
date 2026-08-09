'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User as UserIcon,
  Loader2,
  Sparkles,
  FolderKanban,
  Calendar,
  Ticket,
  ChevronRight,
} from '@repo/ui/lib/icons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ChatMessage } from './chat-client.types';
import { SUGGESTIONS } from './chat-client.data';
import { sendChatMessage } from './chat-client.service';

let messageCounter = 0;

export function ChatClient() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isPending]);

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

    // Keep conversation history in format expected by backend chat route
    const history = [...messages, userMessage].map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    try {
      const response = await sendChatMessage(history);

      if (response.error) {
        setError(response.error);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-${++messageCounter}`,
            role: 'assistant',
            content: response.reply,
            actions: response.actions,
          },
        ]);
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

  return (
    <div className="border-sidebar-border bg-card flex h-[calc(100vh-140px)] flex-col overflow-hidden rounded-xl border shadow-sm">
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
      </div>

      {/* Message list */}
      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        {messages.length === 0 ? (
          <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center space-y-6 text-center">
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
                          {message.actions.map((act) => {
                            const actionKey = `${act.type}-${act.entity.id}`;
                            if (act.type === 'create_project') {
                              return (
                                <div
                                  key={actionKey}
                                  className="dark:text-emerald-350 flex items-center justify-between rounded border border-emerald-500/20 bg-emerald-500/5 p-2.5 text-emerald-950"
                                >
                                  <div className="flex items-center gap-2">
                                    <FolderKanban className="h-4 w-4 text-emerald-500" />
                                    <span className="text-xs">
                                      Project Created:{' '}
                                      <strong>{act.entity.name}</strong> (
                                      {act.entity.key})
                                    </span>
                                  </div>
                                  <Link
                                    href={`/projects`}
                                    className="text-[11px] underline transition-colors hover:text-emerald-700"
                                  >
                                    View
                                  </Link>
                                </div>
                              );
                            }
                            if (act.type === 'create_sprint') {
                              return (
                                <div
                                  key={actionKey}
                                  className="dark:text-blue-350 flex items-center justify-between rounded border border-blue-500/20 bg-blue-500/5 p-2.5 text-blue-950"
                                >
                                  <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-blue-500" />
                                    <span className="text-xs">
                                      Sprint Created:{' '}
                                      <strong>{act.entity.name}</strong>
                                    </span>
                                  </div>
                                  <Link
                                    href={`/sprints`}
                                    className="text-[11px] underline transition-colors hover:text-blue-700"
                                  >
                                    View
                                  </Link>
                                </div>
                              );
                            }
                            if (act.type === 'create_work_item') {
                              return (
                                <div
                                  key={actionKey}
                                  className="dark:text-indigo-350 flex items-center justify-between rounded border border-indigo-500/20 bg-indigo-500/5 p-2.5 text-indigo-950"
                                >
                                  <div className="flex items-center gap-2">
                                    <Ticket className="h-4 w-4 text-indigo-500" />
                                    <span className="text-xs">
                                      Work Item Created:{' '}
                                      <strong>{act.entity.key}</strong> -{' '}
                                      {act.entity.title}
                                    </span>
                                  </div>
                                  <Link
                                    href={`/work-items/${act.entity.id}`}
                                    className="text-[11px] underline transition-colors hover:text-indigo-700"
                                  >
                                    View Details
                                  </Link>
                                </div>
                              );
                            }
                            return null;
                          })}
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
            disabled={isPending}
            placeholder="Type your message (e.g. create a work item on Beta project)..."
            className="border-sidebar-border bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex-1 rounded-lg border px-4 py-2.5 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isPending}
            className="bg-primary text-primary-foreground ring-offset-background hover:bg-primary/95 focus-visible:ring-ring inline-flex cursor-pointer items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
