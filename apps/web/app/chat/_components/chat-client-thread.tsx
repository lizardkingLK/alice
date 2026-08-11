'use client';

import { Loader2 } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { ChatRoles } from '@repo/types';
import type { ChatMessage } from './chat-client.types';
import { ChatExecutedActionCard } from './chat-executed-action-card';
import ChatBotAvatar from '@/app/chat/_components/chat-client-bot-avatar';
import ChatUserAvatar from '@/app/chat/_components/chat-client-user-avatar';
import ChatAliceStatusRow from '@/app/chat/_components/chat-client-alice-status-row';

type ChatClientThreadProps = {
  readonly isPage: boolean;
  readonly showEmptyThread: boolean;
  readonly messages: ChatMessage[];
  readonly isPending: boolean;
  readonly error: string | null;
  readonly currentUserName?: string | null;
  readonly currentUserImageUrl?: string | null;
  readonly messagesEndRef: React.RefObject<HTMLDivElement | null>;
};

export default function ChatClientThread({
  isPage,
  showEmptyThread,
  messages,
  isPending,
  error,
  currentUserName,
  currentUserImageUrl,
  messagesEndRef,
}: Readonly<ChatClientThreadProps>) {
  return (
    <div className={cn(isPage ? 'p-4 sm:p-6' : 'p-4')}>
      {showEmptyThread ? (
        <div className="mx-auto flex min-h-[min(24rem,calc(100dvh-12rem))] max-w-3xl flex-col items-center justify-center text-center">
          <p className="text-muted-foreground text-sm">
            No messages in this conversation yet. Send a message below to
            continue.
          </p>
        </div>
      ) : (
        <div className="mx-auto max-w-3xl space-y-6">
          {messages.map((message) => {
            const isUser = message.role === ChatRoles.User;
            return (
              <div
                key={message.id}
                className={cn(
                  'flex gap-3',
                  isUser ? 'justify-end' : 'justify-start'
                )}
              >
                {!isUser ? <ChatBotAvatar /> : null}

                <div
                  className={cn(
                    'flex max-w-[min(85%,42rem)] min-w-0 flex-col gap-1.5',
                    isUser ? 'items-end' : 'items-start'
                  )}
                >
                  <span className="text-foreground px-1 text-xs font-semibold">
                    {isUser ? 'You' : 'Alice'}
                  </span>

                  <div
                    className={cn(
                      'w-full rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap',
                      isUser
                        ? 'bg-primary text-primary-foreground rounded-tr-md font-medium'
                        : 'bg-muted/50 border-border text-foreground rounded-tl-md border leading-relaxed'
                    )}
                  >
                    <div>{message.content}</div>

                    {message.actions && message.actions.length > 0 ? (
                      <div className="border-border/40 mt-3 space-y-2 border-t pt-3">
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
                    ) : null}
                  </div>
                </div>

                {isUser ? (
                  <ChatUserAvatar
                    name={currentUserName}
                    imageUrl={currentUserImageUrl}
                  />
                ) : null}
              </div>
            );
          })}

          {isPending ? (
            <ChatAliceStatusRow bubbleClassName="bg-muted/50 border-border text-muted-foreground flex items-center gap-2">
              <Loader2 className="text-primary size-4 animate-spin" />
              <span>Thinking and executing actions...</span>
            </ChatAliceStatusRow>
          ) : null}

          {error ? (
            <ChatAliceStatusRow bubbleClassName="bg-destructive/5 border-destructive/20 text-destructive flex w-full flex-col gap-1">
              <span className="text-xs font-semibold tracking-wider uppercase">
                Error Encountered
              </span>
              <span>{error}</span>
            </ChatAliceStatusRow>
          ) : null}
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}
