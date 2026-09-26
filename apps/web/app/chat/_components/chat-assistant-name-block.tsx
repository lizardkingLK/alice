'use client';

import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { cn } from '@repo/ui/lib/utils';
import {
  DEFAULT_CHAT_ASSISTANT_NAME,
  type ChatAssistantIdentity,
} from '@/app/chat/_helpers/use-bound-chat-agent';

type ChatAssistantNameBlockProps = {
  readonly identity?: ChatAssistantIdentity | null;
  readonly nameClassName?: string;
  readonly titleClassName?: string;
  readonly className?: string;
};

/** Name + optional role title (Monday-style) for chat header / message rows. */
export function ChatAssistantNameBlock({
  identity = null,
  nameClassName,
  titleClassName,
  className,
}: Readonly<ChatAssistantNameBlockProps>) {
  const name = identity?.name ?? DEFAULT_CHAT_ASSISTANT_NAME;
  const title = identity?.title?.trim() ?? '';

  return (
    <div className={cn('min-w-0 text-left', className)}>
      <TruncatedText
        as="span"
        className={cn('block text-sm font-semibold', nameClassName)}
      >
        {name}
      </TruncatedText>
      {title ? (
        <TruncatedText
          as="span"
          className={cn('text-muted-foreground block text-xs', titleClassName)}
        >
          {title}
        </TruncatedText>
      ) : null}
    </div>
  );
}
