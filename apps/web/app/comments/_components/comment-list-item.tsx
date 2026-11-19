'use client';

import { useMemo, type ReactNode } from 'react';
import type { JSONContent } from '@tiptap/react';
import Link from 'next/link';
import type { CommentReactionEmoji } from '@repo/types';
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
  Bot,
  ExternalLink,
  Eye,
  EyeOff,
  MoreHorizontal,
  Pencil,
  Reply,
  RotateCcw,
  Tag,
  Trash2,
} from '@repo/ui/lib/icons';
import { UserAvatar } from '@/components/user-avatar';
import { useRealtime } from '@/components/realtime/realtime-provider';
import {
  CommentContentView,
  type CommentUserMentionTarget,
} from '@/app/comments/_components/comment-content-view';
import { CommentEditorFormShell } from '@/app/comments/_components/comment-editor-form-shell';
import type { CommentMentionAgent } from '@/app/comments/_components/comment-mention-list';
import { CommentReactionBar } from '@/app/comments/_components/comment-reaction-bar';
import { CommentRelativeTime } from '@/app/comments/_components/comment-relative-time';
import { extractAgentMentionsFromDoc } from '@/app/comments/_helpers/comment-agent-mentions';
import type {
  CommentItem,
  CommentUser,
  CommentWorkItemOption,
} from '@/app/comments/_services/comments.mutations.shared';
import { workItemDetailHref } from '@/app/work-items/_helpers/work-item-links';

const ISSUE_BADGE_CLASS =
  'border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400';

/* eslint-disable no-unused-vars -- documents reaction toggle and suggestion contracts */
type ReactionToggleHandler = (
  emoji: CommentReactionEmoji,
  action: 'add' | 'remove'
) => void;

export type AiSuggestionsRequestHandler = (
  agentId: string,
  agentLabel: string,
  commentId: string
) => void;
/* eslint-enable no-unused-vars */

type CommentListItemProps = {
  comment: CommentItem;
  activeUserId?: string;
  showWorkItemBadge?: boolean;
  isEditing: boolean;
  isReplying: boolean;
  users: CommentUser[];
  agents: CommentMentionAgent[];
  workItems: CommentWorkItemOption[];
  replySlot?: ReactNode;
  isHidden?: boolean;
  canHide?: boolean;
  isParent?: boolean;
  onHide?: () => void;
  onUnhide?: () => void;
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
  onToggleReaction?: ReactionToggleHandler;
  isReactionSyncing?: boolean;
  onRequestAiSuggestions?: AiSuggestionsRequestHandler;
};

function CommentWorkItemBadge({
  workItem,
}: Readonly<{ workItem: NonNullable<CommentItem['work_item']> }>) {
  return (
    <Badge
      variant="outline"
      asChild
      className={cn('gap-1.5 font-semibold', ISSUE_BADGE_CLASS)}
    >
      <Link
        href={workItemDetailHref(workItem.id, {
          projectKey: workItem.project?.key,
          workItemSlug: workItem.slug,
        })}
      >
        <Tag className="size-3 shrink-0" />
        {workItem.key}
        <ExternalLink className="size-3 opacity-60" />
      </Link>
    </Badge>
  );
}

function CommentOwnerActions({
  onStartEdit,
  onArchive,
  canHide,
  isParent,
  onHide,
}: Readonly<{
  onStartEdit: () => void;
  onArchive: () => void;
  canHide?: boolean;
  isParent?: boolean;
  onHide?: () => void;
}>) {
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Edit"
        title="Edit"
        onClick={onStartEdit}
      >
        <Pencil className="size-3.5" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="More actions"
            title="More actions"
          >
            <MoreHorizontal className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {canHide && onHide ? (
            <DropdownMenuItem
              onClick={onHide}
              className="text-muted-foreground focus:text-foreground gap-2"
              data-testid="hide-comment-btn"
            >
              <EyeOff className="size-3.5" />
              {isParent ? 'Hide thread from my view' : 'Hide from my view'}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            onClick={onArchive}
            className="gap-2 text-amber-600 focus:text-amber-600"
          >
            <Archive className="size-3.5" />
            Archive
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

function CommentActiveFooter({
  comment,
  activeUserId,
  users,
  isOwner,
  isHidden,
  canHide,
  isParent,
  isReactionSyncing,
  onStartReply,
  onStartEdit,
  onArchive,
  onHide,
  onUnhide,
  onToggleReaction,
  onRequestAiSuggestions,
}: Readonly<{
  comment: CommentItem;
  activeUserId?: string;
  users: CommentUser[];
  isOwner: boolean;
  isHidden?: boolean;
  canHide?: boolean;
  isParent?: boolean;
  isReactionSyncing?: boolean;
  onStartReply: () => void;
  onStartEdit: () => void;
  onArchive: () => void;
  onHide?: () => void;
  onUnhide?: () => void;
  onToggleReaction?: ReactionToggleHandler;
  onRequestAiSuggestions?: AiSuggestionsRequestHandler;
}>) {
  const agentMentions = useMemo(
    () => extractAgentMentionsFromDoc(comment.content),
    [comment.content]
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <CommentRelativeTime value={comment.created_at} />
        {onToggleReaction ? (
          <CommentReactionBar
            reactions={comment.reactions}
            activeUserId={activeUserId}
            users={users}
            isSyncing={isReactionSyncing}
            onToggle={onToggleReaction}
          />
        ) : null}
      </div>
      <div className="text-muted-foreground flex flex-wrap items-center gap-1">
        {onRequestAiSuggestions &&
          agentMentions.map((agent) => (
            <Button
              key={agent.agentId}
              type="button"
              variant="outline"
              size="xs"
              className="gap-1 border-emerald-500/30 text-xs text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
              data-testid="request-ai-suggestions-btn"
              aria-label={`Ask @${agent.label} for suggestions`}
              title={`Ask @${agent.label} for suggestions`}
              onClick={() =>
                onRequestAiSuggestions(agent.agentId, agent.label, comment.id)
              }
            >
              <Bot
                className="size-3 text-emerald-600 dark:text-emerald-400"
                aria-hidden
              />
              Suggest with @{agent.label}
            </Button>
          ))}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Reply"
          title="Reply"
          onClick={onStartReply}
        >
          <Reply className="size-3.5" />
        </Button>
        {isHidden && onUnhide ? (
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="text-muted-foreground hover:text-foreground gap-1 text-xs"
            data-testid="unhide-comment-btn"
            onClick={onUnhide}
          >
            <Eye className="size-3.5" />
            {isParent ? 'Unhide thread' : 'Unhide'}
          </Button>
        ) : null}
        {isOwner ? (
          <CommentOwnerActions
            onStartEdit={onStartEdit}
            onArchive={onArchive}
            canHide={canHide}
            isParent={isParent}
            onHide={onHide}
          />
        ) : null}
      </div>
    </div>
  );
}

function CommentArchivedFooter({
  createdAt,
  isOwner,
  onRestore,
  onPurge,
}: Readonly<{
  createdAt: string;
  isOwner: boolean;
  onRestore: () => void;
  onPurge: () => void;
}>) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <CommentRelativeTime value={createdAt} />
      {isOwner ? (
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
            className="gap-1.5"
            onClick={onPurge}
          >
            <Trash2 className="size-3.5" />
            Purge
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function CommentListItem({
  comment,
  activeUserId,
  showWorkItemBadge = false,
  isEditing,
  isReplying,
  users,
  agents,
  workItems,
  replySlot,
  isHidden = false,
  canHide = false,
  isParent = false,
  onHide,
  onUnhide,
  onUserMentionClick,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onStartReply,
  onArchive,
  onRestore,
  onPurge,
  onToggleReaction,
  isReactionSyncing = false,
  onRequestAiSuggestions,
}: Readonly<CommentListItemProps>) {
  const { isUserOnline } = useRealtime();
  const isOwner = comment.author_id === activeUserId;
  const showActiveFooter = !isEditing && comment.status === 'active';
  const showArchivedFooter = !isEditing && comment.status === 'archived';

  return (
    <div
      className={cn(
        'flex items-start gap-3',
        comment.status === 'archived' && 'opacity-70',
        isHidden &&
          'border-muted-foreground/30 bg-muted/20 rounded-md border border-dashed p-2 opacity-75'
      )}
    >
      <UserAvatar
        name={comment.author?.name}
        imageUrl={comment.author?.profile_picture}
        isOnline={isUserOnline(comment.author_id)}
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
              {isHidden ? (
                <Badge
                  variant="outline"
                  className="border-muted-foreground/30 text-muted-foreground gap-1 text-xs"
                  data-testid="hidden-comment-badge"
                >
                  <EyeOff className="size-3" />
                  Hidden from your view
                </Badge>
              ) : null}
              {comment.edited ? (
                <span className="text-muted-foreground text-[11px] italic">
                  (edited)
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {showWorkItemBadge && comment.work_item ? (
              <CommentWorkItemBadge workItem={comment.work_item} />
            ) : null}
          </div>
        </div>

        {isEditing ? (
          <CommentEditorFormShell
            users={users}
            agents={agents}
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

        {showActiveFooter ? (
          <CommentActiveFooter
            comment={comment}
            activeUserId={activeUserId}
            users={users}
            isOwner={isOwner}
            isHidden={isHidden}
            canHide={canHide}
            isParent={isParent}
            isReactionSyncing={isReactionSyncing}
            onStartReply={onStartReply}
            onStartEdit={onStartEdit}
            onArchive={onArchive}
            onHide={onHide}
            onUnhide={onUnhide}
            onToggleReaction={onToggleReaction}
            onRequestAiSuggestions={onRequestAiSuggestions}
          />
        ) : null}

        {showArchivedFooter ? (
          <CommentArchivedFooter
            createdAt={comment.created_at}
            isOwner={isOwner}
            onRestore={onRestore}
            onPurge={onPurge}
          />
        ) : null}

        {isReplying ? replySlot : null}
      </div>
    </div>
  );
}
