'use client';

import Image from 'next/image';
import { Bot, Sparkles } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import type { ChatAgentKind } from '@/app/chat/_helpers/chat-agents-catalog';
import { resolveChatAgentAvatarUrl } from '@/app/chat/_helpers/chat-agents-catalog';
import type { ChatAgentAvatarStyle } from '@/app/chat/_helpers/chat-agent-avatar';

type ChatAgentAvatarSize = 'sm' | 'md' | 'lg' | 'xl';

type ChatAgentAvatarProps = {
  readonly name: string;
  readonly kind: ChatAgentKind;
  readonly avatarStyle?: ChatAgentAvatarStyle | null;
  readonly avatarSeed?: string | null;
  readonly size?: ChatAgentAvatarSize;
  readonly className?: string;
};

const SIZE_CLASS: Record<ChatAgentAvatarSize, string> = {
  sm: 'size-9',
  md: 'size-12',
  lg: 'size-16',
  xl: 'size-24',
};

const ICON_SIZE_CLASS: Record<ChatAgentAvatarSize, string> = {
  sm: 'size-4',
  md: 'size-5',
  lg: 'size-7',
  xl: 'size-10',
};

const IMAGE_SIZES: Record<ChatAgentAvatarSize, string> = {
  sm: '36px',
  md: '48px',
  lg: '64px',
  xl: '96px',
};

const PIXEL_SIZE: Record<ChatAgentAvatarSize, number> = {
  sm: 72,
  md: 96,
  lg: 128,
  xl: 192,
};

/** DiceBear character portrait for agent cards; falls back to kind icon. */
export function ChatAgentAvatar({
  name,
  kind,
  avatarStyle,
  avatarSeed,
  size = 'md',
  className,
}: Readonly<ChatAgentAvatarProps>) {
  const frameClass = cn(
    'bg-muted relative shrink-0 overflow-hidden rounded-xl',
    SIZE_CLASS[size],
    className
  );

  const src =
    avatarStyle && avatarSeed
      ? resolveChatAgentAvatarUrl(
          { avatarStyle, avatarSeed },
          PIXEL_SIZE[size]
        )
      : null;

  if (src) {
    return (
      <div className={frameClass}>
        <Image
          src={src}
          alt=""
          fill
          sizes={IMAGE_SIZES[size]}
          className="object-cover"
          unoptimized
          aria-hidden
        />
        <span className="sr-only">{name}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        frameClass,
        'bg-primary/10 text-primary flex items-center justify-center'
      )}
      aria-hidden
    >
      {kind === 'system' ? (
        <Sparkles className={ICON_SIZE_CLASS[size]} />
      ) : (
        <Bot className={ICON_SIZE_CLASS[size]} />
      )}
    </div>
  );
}
