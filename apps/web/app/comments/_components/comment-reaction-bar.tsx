'use client';

import { useMemo, useState } from 'react';
import {
  COMMENT_REACTION_EMOJIS,
  summarizeCommentReactions,
  type CommentReactionEmoji,
  type Json,
} from '@repo/types';
import { Button } from '@repo/ui/components/ui/button';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@repo/ui/components/ui/hover-card';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@repo/ui/components/ui/popover';
import { Loader2, SmilePlus } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import type { CommentUser } from '@/app/comments/_services/comments.mutations.shared';

type CommentReactionBarProps = {
  reactions: Json | null | undefined;
  activeUserId?: string;
  users: readonly CommentUser[];
  disabled?: boolean;
  /** True while this comment's reaction flush is still in flight. */
  isSyncing?: boolean;
  // eslint-disable-next-line no-unused-vars -- toggle callback
  onToggle: (emoji: CommentReactionEmoji, action: 'add' | 'remove') => void;
};

function resolveReactorNames(
  userIds: readonly string[],
  users: readonly CommentUser[]
): string[] {
  const byId = new Map(users.map((user) => [user.id, user.name] as const));
  return userIds.map((id) => byId.get(id) || 'Unknown');
}

export function CommentReactionBar({
  reactions,
  activeUserId,
  users,
  disabled = false,
  isSyncing = false,
  onToggle,
}: Readonly<CommentReactionBarProps>) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const summaries = useMemo(
    () => summarizeCommentReactions(reactions, activeUserId),
    [reactions, activeUserId]
  );

  const handlePick = (emoji: CommentReactionEmoji) => {
    const existing = summaries.find((summary) => summary.emoji === emoji);
    const action = existing?.includesMe ? 'remove' : 'add';
    onToggle(emoji, action);
    setPickerOpen(false);
  };

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-1',
        isSyncing && 'opacity-80'
      )}
    >
      {isSyncing ? (
        <Loader2
          className="text-muted-foreground size-3.5 shrink-0 animate-spin"
          aria-label="Saving reactions"
        />
      ) : null}
      {summaries.map((summary) => {
        const names = resolveReactorNames(summary.userIds, users);
        return (
          <HoverCard key={summary.emoji} openDelay={200} closeDelay={100}>
            <HoverCardTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                aria-pressed={summary.includesMe}
                aria-label={`${summary.emoji} ${summary.count}`}
                className={cn(
                  'h-7 gap-1 rounded-full px-2 text-xs font-medium',
                  summary.includesMe &&
                    'border-primary/40 bg-primary/10 text-foreground'
                )}
                onClick={() =>
                  onToggle(summary.emoji, summary.includesMe ? 'remove' : 'add')
                }
              >
                <span aria-hidden>{summary.emoji}</span>
                <span>{summary.count}</span>
              </Button>
            </HoverCardTrigger>
            <HoverCardContent
              side="top"
              align="start"
              className="w-auto max-w-56 p-2 text-xs"
            >
              <p className="text-muted-foreground leading-relaxed">
                {names.join(', ')}
              </p>
            </HoverCardContent>
          </HoverCard>
        );
      })}

      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            aria-label="Add reaction"
            title="Add reaction"
          >
            <SmilePlus className="size-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-2">
          <div
            className="grid grid-cols-5 gap-1"
            role="listbox"
            aria-label="Reaction picker"
          >
            {COMMENT_REACTION_EMOJIS.map((emoji) => {
              const mine = summaries.some(
                (summary) => summary.emoji === emoji && summary.includesMe
              );
              return (
                <Button
                  key={emoji}
                  type="button"
                  variant={mine ? 'secondary' : 'ghost'}
                  size="icon-sm"
                  aria-label={`React with ${emoji}`}
                  aria-pressed={mine}
                  className="text-base"
                  onClick={() => handlePick(emoji)}
                >
                  <span aria-hidden>{emoji}</span>
                </Button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
