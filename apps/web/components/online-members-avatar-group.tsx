'use client';

import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from '@repo/ui/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import { cn } from '@repo/ui/lib/utils';
import { getInitials } from '@/app/_shared/utility';

export type OnlineMemberAvatar = {
  readonly id: string;
  readonly name: string;
  readonly profilePicture?: string | null;
};

type OnlineMembersAvatarGroupProps = {
  readonly members: readonly OnlineMemberAvatar[];
  readonly currentUserId?: string | null;
  // eslint-disable-next-line no-unused-vars -- online lookup
  readonly isUserOnline: (userId: string) => boolean;
  readonly visibleCount?: number;
  readonly className?: string;
};

/**
 * Unified online presence strip: other online members only (max faces + `+n`).
 * Primary-tinted pill when 2+ are online; single face has no pill.
 * Tooltip: "{name} · online". No per-avatar green bullets.
 * Renders nothing when nobody else is online.
 */
export function OnlineMembersAvatarGroup({
  members,
  currentUserId,
  isUserOnline,
  visibleCount = 3,
  className,
}: Readonly<OnlineMembersAvatarGroupProps>) {
  const onlineOthers = members.filter(
    (member) => member.id !== currentUserId && isUserOnline(member.id)
  );

  if (onlineOthers.length === 0) {
    return null;
  }

  const visible = onlineOthers.slice(0, visibleCount);
  const overflowCount = onlineOthers.length - visible.length;
  const showOnlinePill = onlineOthers.length > 1;

  return (
    <div
      className={cn(
        'inline-flex items-center',
        showOnlinePill &&
          'border-primary/25 bg-primary/15 rounded-full border py-0.5 pr-1.5 pl-1',
        className
      )}
      role="group"
      aria-label="Online project members"
    >
      <AvatarGroup
        className={cn(
          '*:data-[slot=avatar]:ring-background',
          showOnlinePill
            ? '*:data-[slot=avatar]:size-7'
            : '*:data-[slot=avatar]:size-8'
        )}
      >
        {visible.map((member) => (
          <Tooltip key={member.id} delayDuration={400}>
            <TooltipTrigger asChild>
              <Avatar
                size="default"
                aria-label={`${member.name} online`}
                className="outline-none"
              >
                {member.profilePicture ? (
                  <AvatarImage src={member.profilePicture} alt={member.name} />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                  {getInitials(member.name)}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {member.name}
              {' · online'}
            </TooltipContent>
          </Tooltip>
        ))}

        {overflowCount > 0 ? (
          <Tooltip delayDuration={400}>
            <TooltipTrigger asChild>
              <AvatarGroupCount
                aria-label={`${overflowCount} more online`}
                className="text-xs font-medium"
              >
                +{overflowCount}
              </AvatarGroupCount>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {onlineOthers
                .slice(visibleCount)
                .map((member) => member.name)
                .join(', ')}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </AvatarGroup>
    </div>
  );
}
