import type { ReactNode } from 'react';
import { cn } from '@repo/ui/lib/utils';
import ChatBotAvatar from '@/app/chat/_components/chat-client-bot-avatar';

type ChatAliceStatusRowProps = {
  readonly bubbleClassName: string;
  readonly children: ReactNode;
};

/** Shared Alice avatar + label + bubble shell (pending / error rows). */
export default function ChatAliceStatusRow({
  bubbleClassName,
  children,
}: Readonly<ChatAliceStatusRowProps>) {
  return (
    <div className="flex justify-start gap-3">
      <ChatBotAvatar />
      <div className="flex max-w-[min(85%,42rem)] min-w-0 flex-col gap-1.5">
        <span className="text-foreground px-1 text-xs font-semibold">
          Alice
        </span>
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
