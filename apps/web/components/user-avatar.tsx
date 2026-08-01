'use client';

import { getInitials } from '@/app/_shared/utility';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@repo/ui/components/ui/avatar';
import { cn } from '@repo/ui/lib/utils';

type UserAvatarProps = {
  readonly name?: string | null;
  readonly imageUrl?: string | null;
  readonly className?: string;
  readonly fallbackClassName?: string;
  readonly title?: string;
};

/** Compact user avatar with optional photo and initials fallback. */
export function UserAvatar({
  name,
  imageUrl,
  className,
  fallbackClassName,
  title,
}: UserAvatarProps) {
  const displayName = name?.trim() || 'Unassigned';

  return (
    <Avatar
      size="sm"
      className={cn('border-border/80 size-6 border', className)}
      title={title ?? displayName}
    >
      {imageUrl ? <AvatarImage src={imageUrl} alt={displayName} /> : null}
      <AvatarFallback
        className={cn(
          'bg-muted text-muted-foreground text-[9px] font-semibold',
          fallbackClassName
        )}
      >
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
