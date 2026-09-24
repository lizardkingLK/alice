'use client';

import Link from 'next/link';
import { Button } from '@repo/ui/components/ui/button';
import { MessageSquarePlus, Plus, Sparkles } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { chatAiAgentsIntegrationsHref } from '@/app/chat/_services/chat-integrations-navigation.shared';

type ChatConversationEmptyPanelProps = {
  readonly kind: 'no-models' | 'no-conversations';
  readonly onCreateConversation?: () => void;
  readonly className?: string;
};

/** Centered empty / gate CTAs for the conversation workspace. */
export function ChatConversationEmptyPanel({
  kind,
  onCreateConversation,
  className,
}: Readonly<ChatConversationEmptyPanelProps>) {
  if (kind === 'no-models') {
    return (
      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center',
          className
        )}
      >
        <Sparkles
          className="text-muted-foreground size-10 stroke-[1.5]"
          aria-hidden
        />
        <div className="max-w-sm space-y-2">
          <h3 className="text-sm font-semibold tracking-tight">
            Add an AI model first
          </h3>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Connect a chat model in Settings before you start a conversation.
          </p>
        </div>
        <Button type="button" className="cursor-pointer gap-2" asChild>
          <Link href={chatAiAgentsIntegrationsHref()}>
            <Plus className="size-4" data-icon="inline-start" />
            Add AI model
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center',
        className
      )}
    >
      <MessageSquarePlus
        className="text-muted-foreground size-10 stroke-[1.5]"
        aria-hidden
      />
      <div className="max-w-sm space-y-2">
        <h3 className="text-sm font-semibold tracking-tight">
          Create a conversation
        </h3>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Start chatting with Alice once you are ready.
        </p>
      </div>
      <Button
        type="button"
        className="cursor-pointer gap-2"
        onClick={onCreateConversation}
      >
        <Plus className="size-4" data-icon="inline-start" />
        Create conversation
      </Button>
    </div>
  );
}
