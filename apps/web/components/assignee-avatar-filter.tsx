'use client';

import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from '@repo/ui/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import { cn } from '@repo/ui/lib/utils';
import { getInitials } from '@/app/_shared/utility';

export type AssigneeAvatarMember = {
  readonly id: string;
  readonly name: string;
  readonly profilePicture: string | null;
};

type AssigneeAvatarFilterProps = {
  readonly members: readonly AssigneeAvatarMember[];
  readonly selectedId: string | null;
  // eslint-disable-next-line no-unused-vars -- assignee toggle
  readonly onSelectedIdChange: (id: string | null) => void;
  readonly visibleCount?: number;
  readonly className?: string;
  /** Optional presence check (e.g. Pusher) for a green online badge. */
  // eslint-disable-next-line no-unused-vars -- online lookup
  readonly isUserOnline?: (userId: string) => boolean;
};

export function AssigneeAvatarFilter({
  members,
  selectedId,
  onSelectedIdChange,
  visibleCount = 4,
  className,
  isUserOnline,
}: Readonly<AssigneeAvatarFilterProps>) {
  const visibleAssignees = members.slice(0, visibleCount);
  const overflowAssignees = members.slice(visibleCount);
  const isOverflowSelected = overflowAssignees.some(
    (member) => member.id === selectedId
  );

  const toggleAssignee = (id: string) => {
    onSelectedIdChange(selectedId === id ? null : id);
  };

  return (
    <AvatarGroup
      className={cn('*:data-[slot=avatar]:size-8', className)}
      role="group"
      aria-label="Filter by assignee"
    >
      {visibleAssignees.map((assignee) => {
        const isSelected = selectedId === assignee.id;
        const online = isUserOnline?.(assignee.id) ?? false;
        return (
          <Tooltip key={assignee.id} delayDuration={400}>
            <TooltipTrigger asChild>
              <Avatar
                size="default"
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                aria-label={`Filter by ${assignee.name}`}
                className={cn(
                  'focus-visible:ring-ring cursor-pointer outline-none focus-visible:ring-2',
                  isSelected &&
                    'ring-primary ring-offset-background z-10 ring-2 ring-offset-2',
                  selectedId && !isSelected && 'opacity-40'
                )}
                onClick={() => toggleAssignee(assignee.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    toggleAssignee(assignee.id);
                  }
                }}
              >
                {assignee.profilePicture ? (
                  <AvatarImage
                    src={assignee.profilePicture}
                    alt={assignee.name}
                  />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                  {getInitials(assignee.name)}
                </AvatarFallback>
                {online ? (
                  <AvatarBadge
                    aria-label="Online"
                    className="top-0 right-0 bottom-auto size-2 bg-emerald-500"
                  />
                ) : null}
              </Avatar>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {assignee.name}
              {isSelected ? ' · filtering' : ''}
              {online ? ' · online' : ''}
            </TooltipContent>
          </Tooltip>
        );
      })}

      {overflowAssignees.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <AvatarGroupCount
              role="button"
              tabIndex={0}
              aria-label="Show more assignees"
              className={cn(
                'focus-visible:ring-ring cursor-pointer text-xs font-medium outline-none focus-visible:ring-2',
                selectedId && !isOverflowSelected && 'opacity-40',
                isOverflowSelected &&
                  'ring-primary ring-offset-background z-10 ring-2 ring-offset-2'
              )}
            >
              +{overflowAssignees.length}
            </AvatarGroupCount>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>More assignees</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {overflowAssignees.map((assignee) => (
              <DropdownMenuCheckboxItem
                key={assignee.id}
                checked={selectedId === assignee.id}
                onCheckedChange={() => toggleAssignee(assignee.id)}
              >
                {assignee.name}
                {isUserOnline?.(assignee.id) ? ' · online' : ''}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </AvatarGroup>
  );
}
