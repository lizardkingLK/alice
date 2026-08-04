'use client';

import { cn } from '@repo/ui/lib/utils';
import { getInitials } from '@/app/_shared/utility';
import { Avatar, AvatarFallback } from '@repo/ui/components/ui/avatar';
import type { CommentUser } from '@/app/comments/_services/comments.service.base';

export type CommentMentionItem = {
  id: string;
  label: string;
  description?: string;
  kind: 'user' | 'workItem';
};

type CommentMentionListProps = {
  items: CommentMentionItem[];
  highlightIdx: number;
  // eslint-disable-next-line no-unused-vars -- select callback
  onSelect: (item: CommentMentionItem) => void;
};

export function CommentMentionList({
  items,
  highlightIdx,
  onSelect,
}: Readonly<CommentMentionListProps>) {
  if (items.length === 0) {
    return (
      <div className="bg-popover text-muted-foreground rounded-md border p-2 text-xs shadow-md">
        No matches
      </div>
    );
  }

  return (
    <ul className="bg-popover max-h-40 w-64 overflow-y-auto rounded-md border p-1 shadow-md">
      {items.map((item, index) => (
        <li key={`${item.kind}-${item.id}`}>
          <button
            type="button"
            className={cn(
              'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm',
              index === highlightIdx
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-muted'
            )}
            onMouseDown={(event) => {
              event.preventDefault();
              onSelect(item);
            }}
          >
            {item.kind === 'user' ? (
              <Avatar size="sm">
                <AvatarFallback className="text-[10px] font-semibold">
                  {getInitials(item.label)}
                </AvatarFallback>
              </Avatar>
            ) : (
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-[10px] font-bold text-violet-600 dark:text-violet-400">
                #
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{item.label}</span>
              {item.description ? (
                <span className="text-muted-foreground block truncate text-xs">
                  {item.description}
                </span>
              ) : null}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function usersToMentionItems(
  users: CommentUser[]
): CommentMentionItem[] {
  return users.map((u) => ({
    id: u.id,
    label: u.name,
    description: u.email,
    kind: 'user' as const,
  }));
}
