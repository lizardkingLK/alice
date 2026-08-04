'use client';

import type { ReactNode } from 'react';
import type { JSONContent } from '@tiptap/react';
import Link from 'next/link';
import { Button } from '@repo/ui/components/ui/button';
import { Badge } from '@repo/ui/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import { cn } from '@repo/ui/lib/utils';
import {
  Archive,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Reply,
  RotateCcw,
  SmilePlus,
  Tag,
  ThumbsUp,
  Trash2,
} from '@repo/ui/lib/icons';
import { formatDateTime } from '@/app/_shared/utility';
import { UserAvatar } from '@/components/user-avatar';
import {
  CommentContentView,
  type CommentUserMentionTarget,
} from '@/app/comments/_components/comment-content-view';
import { CommentEditorFormShell } from '@/app/comments/_components/comment-editor-form-shell';
import type {
  CommentItem,
  CommentUser,
  CommentWorkItemOption,
} from '@/app/comments/_services/comments.service.base';

const ISSUE_BADGE_CLASS =
  'border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400';

type CommentListItemProps = {
  comment: CommentItem;
  activeUserId?: string;
  showWorkItemBadge?: boolean;
  isEditing: boolean;
  isReplying: boolean;
  users: CommentUser[];
  workItems: Pick<CommentWorkItemOption, 'id' | 'key' | 'title'>[];
  replySlot?: ReactNode;
  // eslint-disable-next-line no-unused-vars -- click callback
  onUserMentionClick?: (mention: CommentUserMentionTarget) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  // eslint-disable-next-line no-unused-vars -- save edit
  onSaveEdit: (doc: JSONContent) => void;
  onStartReply: () => void;
  onCancelReply: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onPurge: () => void;
  // eslint-disable-next-line no-unused-vars -- insert emoji into reply/edit
  onQuickEmoji?: (emoji: string) => void;
};

export function CommentListItem({
  comment,
  activeUserId,
  showWorkItemBadge = false,
  isEditing,
  isReplying,
  users,
  workItems,
  replySlot,
  onUserMentionClick,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onStartReply,
  onArchive,
  onRestore,
  onPurge,
  onQuickEmoji,
}: Readonly<CommentListItemProps>) {
  const isOwner = comment.author_id === activeUserId;

  return (
    <div
      className={cn(
        'flex items-start gap-3',
        comment.status === 'archived' && 'opacity-70'
      )}
    >
      <UserAvatar
        name={comment.author?.name}
        imageUrl={comment.author?.profile_picture}
        className="mt-0.5 size-8 shrink-0 border-0"
        fallbackClassName="bg-primary/10 text-primary text-xs font-semibold"
      />

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-foreground text-sm font-semibold">
                {comment.author?.name || 'Anonymous User'}
              </span>
              {comment.status === 'archived' ? (
                <Badge
                  variant="outline"
                  className="border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                >
                  Archived
                </Badge>
              ) : null}
              {comment.edited ? (
                <span className="text-muted-foreground text-[11px] italic">
                  (edited)
                </span>
              ) : null}
            </div>
            <p className="text-muted-foreground text-xs">
              {formatDateTime(comment.created_at)}
            </p>
          </div>

          <div className="flex items-center gap-1">
            {showWorkItemBadge && comment.work_item ? (
              <Badge
                variant="outline"
                asChild
                className={cn('gap-1.5 font-semibold', ISSUE_BADGE_CLASS)}
              >
                <Link href={`/work-items/${comment.work_item.id}`}>
                  <Tag className="size-3 shrink-0" />
                  {comment.work_item.key}
                  <ExternalLink className="size-3 opacity-60" />
                </Link>
              </Badge>
            ) : null}
          </div>
        </div>

        {isEditing ? (
          <CommentEditorFormShell
            users={users}
            workItems={workItems}
            initialContent={comment.content}
            autoFocus
            submitLabel="Save"
            onCancel={onCancelEdit}
            onSubmit={onSaveEdit}
          />
        ) : (
          <CommentContentView
            content={comment.content}
            users={users}
            workItems={workItems}
            onUserMentionClick={onUserMentionClick}
          />
        )}

        {!isEditing && comment.status === 'active' ? (
          <div className="text-muted-foreground flex flex-wrap items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Reply"
              onClick={onStartReply}
            >
              <Reply className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="React"
              onClick={() => onQuickEmoji?.('👍')}
            >
              <ThumbsUp className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Add emoji"
              onClick={() => onQuickEmoji?.('😊')}
            >
              <SmilePlus className="size-3.5" />
            </Button>
            {isOwner ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Edit"
                onClick={onStartEdit}
              >
                <Pencil className="size-3.5" />
              </Button>
            ) : null}
            {isOwner ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="More actions"
                  >
                    <MoreHorizontal className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem
                    onClick={onArchive}
                    className="gap-2 text-amber-600 focus:text-amber-600"
                  >
                    <Archive className="size-3.5" />
                    Archive
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        ) : null}

        {!isEditing && comment.status === 'archived' && isOwner ? (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-emerald-600"
              onClick={onRestore}
            >
              <RotateCcw className="size-3.5" />
              Restore
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive gap-1.5"
              onClick={onPurge}
            >
              <Trash2 className="size-3.5" />
              Purge
            </Button>
          </div>
        ) : null}

        {isReplying ? replySlot : null}
      </div>
    </div>
  );
}
