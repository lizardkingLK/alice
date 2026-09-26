'use client';

import type { ReactNode } from 'react';
import { cn } from '@repo/ui/lib/utils';
import ChatBotAvatar from '@/app/chat/_components/chat-client-bot-avatar';
import { ChatAssistantNameBlock } from '@/app/chat/_components/chat-assistant-name-block';
import type { ChatAssistantIdentity } from '@/app/chat/_helpers/use-bound-chat-agent';

type ChatAliceStatusRowProps = {
  readonly bubbleClassName: string;
  readonly children: ReactNode;
  readonly identity?: ChatAssistantIdentity | null;
};

/** Shared assistant avatar + label + bubble shell (pending / error rows). */
export default function ChatAliceStatusRow({
  bubbleClassName,
  children,
  identity = null,
}: Readonly<ChatAliceStatusRowProps>) {
  return (
    <div className="flex justify-start gap-3">
      <ChatBotAvatar identity={identity} />
      <div className="flex max-w-[min(85%,42rem)] min-w-0 flex-col gap-1.5">
        <ChatAssistantNameBlock
          identity={identity}
          className="px-1"
          nameClassName="text-xs"
          titleClassName="text-[11px]"
        />
        <div
          className={cn(
            'rounded-2xl rounded-tl-md border px-4 py-3 text-sm',
            bubbleClassName
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
