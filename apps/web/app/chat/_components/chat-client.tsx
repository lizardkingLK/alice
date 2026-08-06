'use client';

import React, { useState, useRef, useEffect } from 'react';
import { apiFetch } from '@/lib/api/api-client';
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

type ActionItem = {
  type: 'create_project' | 'create_sprint' | 'create_work_item';
  entity: {
    id: string;
    name?: string;
    key?: string;
    title?: string;
    status?: string;
  };
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: ActionItem[];
};

const SUGGESTIONS = [
  {
    title: 'Create new work-item creation flow',
    prompt: 'I need to add new work-item creation on selected project and selected sprint assigning to the relevant user.',
    icon: Sparkles,
  },
  {
    title: 'List my current projects',
    prompt: 'Can you show me all the projects in the workspace?',
    icon: FolderKanban,
  },
  {
    title: 'Create a new bug task',
    prompt: 'Create a new bug task titled "Fix registration login failure" with high priority.',
    icon: Ticket,
  },
];

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
      const response = await apiFetch<{
        reply: string;
        actions?: ActionItem[];
        error?: string;
      }>('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: history }),
      });

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
      const message = err instanceof Error ? err.message : 'Something went wrong. Please check if backend API and GEMINI_API_KEY are configured.';
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
    <div className="flex h-[calc(100vh-140px)] flex-col rounded-xl border border-sidebar-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-sidebar-border px-6 py-4 bg-muted/40">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">AI Assistant</h2>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Powered by Google Gemini</span>
            </p>
          </div>
        </div>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full max-w-xl mx-auto text-center space-y-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/5 text-primary">
              <Sparkles className="h-8 w-8 animate-pulse" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold tracking-tight">How can I help you today?</h3>
              <p className="text-sm text-muted-foreground">
                Ask me to create a project, manage sprints, assign tasks to team members, or handle complete workflow creation conversations.
              </p>
            </div>

            {/* Suggestions cards */}
            <div className="grid grid-cols-1 gap-3 w-full mt-4">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  type="button"
                  key={suggestion.title}
                  onClick={() => handleSendMessage(suggestion.prompt)}
                  className="flex items-start gap-4 p-4 text-left rounded-lg border border-sidebar-border hover:border-primary/45 hover:bg-muted/30 transition-all group"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    <suggestion.icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <h4 className="text-sm font-medium group-hover:text-primary transition-colors">
                      {suggestion.title}
                    </h4>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {suggestion.prompt}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 self-center text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-w-3xl mx-auto">
            {messages.map((message) => {
              const isUser = message.role === 'user';
              return (
                <div key={message.id} className={`flex gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
                  {/* Bot Avatar */}
                  {!isUser && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary border border-primary/20">
                      <Bot className="h-4 w-4" />
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div
                    className={`flex flex-col gap-2 rounded-lg px-4 py-3 max-w-[85%] text-sm ${
                      isUser
                        ? 'bg-primary text-primary-foreground font-medium rounded-tr-none'
                        : 'bg-muted border border-sidebar-border rounded-tl-none text-foreground leading-relaxed whitespace-pre-wrap'
                    }`}
                  >
                    <div>{message.content}</div>

                    {/* Action Cards */}
                    {message.actions && message.actions.length > 0 && (
                      <div className="mt-3 space-y-2 border-t border-sidebar-border/40 pt-3">
                        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                          Executed Actions
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          {message.actions.map((act) => {
                            const actionKey = `${act.type}-${act.entity.id}`;
                            if (act.type === 'create_project') {
                              return (
                                <div key={actionKey} className="flex items-center justify-between p-2.5 rounded border border-emerald-500/20 bg-emerald-500/5 text-emerald-950 dark:text-emerald-350">
                                  <div className="flex items-center gap-2">
                                    <FolderKanban className="h-4 w-4 text-emerald-500" />
                                    <span className="text-xs">
                                      Project Created: <strong>{act.entity.name}</strong> ({act.entity.key})
                                    </span>
                                  </div>
                                  <Link
                                    href={`/projects`}
                                    className="text-[11px] underline hover:text-emerald-700 transition-colors"
                                  >
                                    View
                                  </Link>
                                </div>
                              );
                            }
                            if (act.type === 'create_sprint') {
                              return (
                                <div key={actionKey} className="flex items-center justify-between p-2.5 rounded border border-blue-500/20 bg-blue-500/5 text-blue-950 dark:text-blue-350">
                                  <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-blue-500" />
                                    <span className="text-xs">
                                      Sprint Created: <strong>{act.entity.name}</strong>
                                    </span>
                                  </div>
                                  <Link
                                    href={`/sprints`}
                                    className="text-[11px] underline hover:text-blue-700 transition-colors"
                                  >
                                    View
                                  </Link>
                                </div>
                              );
                            }
                            if (act.type === 'create_work_item') {
                              return (
                                <div key={actionKey} className="flex items-center justify-between p-2.5 rounded border border-indigo-500/20 bg-indigo-500/5 text-indigo-950 dark:text-indigo-350">
                                  <div className="flex items-center gap-2">
                                    <Ticket className="h-4 w-4 text-indigo-500" />
                                    <span className="text-xs">
                                      Work Item Created: <strong>{act.entity.key}</strong> - {act.entity.title}
                                    </span>
                                  </div>
                                  <Link
                                    href={`/work-items/${act.entity.id}`}
                                    className="text-[11px] underline hover:text-indigo-700 transition-colors"
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
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground border border-sidebar-border">
                      <UserIcon className="h-4 w-4" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Pending State */}
            {isPending && (
              <div className="flex gap-4 justify-start">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary border border-primary/20">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-2 bg-muted border border-sidebar-border rounded-lg rounded-tl-none px-4 py-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>Thinking and executing actions...</span>
                </div>
              </div>
            )}

            {/* Error Bubble */}
            {error && (
              <div className="flex gap-4 justify-start">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive border border-destructive/20">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="flex flex-col gap-1 bg-destructive/5 border border-destructive/20 rounded-lg rounded-tl-none px-4 py-3 text-sm text-destructive max-w-[85%]">
                  <span className="font-semibold text-xs uppercase tracking-wider">Error Encountered</span>
                  <span>{error}</span>
                </div>
              </div>
            )}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="border-t border-sidebar-border p-4 bg-muted/20">
        <form onSubmit={handleFormSubmit} className="flex gap-3 max-w-3xl mx-auto">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isPending}
            placeholder="Type your message (e.g. create a work item on Beta project)..."
            className="flex-1 rounded-lg border border-sidebar-border bg-background px-4 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isPending}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
