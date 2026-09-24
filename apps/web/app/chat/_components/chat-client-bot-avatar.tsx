'use client';

import { Sparkles } from '@repo/ui/lib/icons';
import { ChatAgentAvatar } from '@/app/chat/_components/chat-agent-avatar';
import type { ChatAssistantIdentity } from '@/app/chat/_helpers/use-bound-chat-agent';

type ChatBotAvatarProps = {
  readonly identity?: ChatAssistantIdentity | null;
};

/** Alice Sparkles mark, or the bound agent's DiceBear portrait. */
export default function ChatBotAvatar({
  identity = null,
}: Readonly<ChatBotAvatarProps>) {
  if (identity) {
    return (
      <ChatAgentAvatar
        name={identity.name}
        kind={identity.kind}
        avatarStyle={identity.avatarStyle}
        avatarSeed={identity.avatarSeed}
        size="sm"
        className="size-8 rounded-lg"
      />
    );
  }

  return (
    <div
      className="bg-primary/10 text-primary border-primary/20 flex size-8 shrink-0 items-center justify-center rounded-lg border"
      aria-hidden
    >
      <Sparkles className="size-4" />
    </div>
  );
}
