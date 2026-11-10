'use client';

import type { JSONContent } from '@tiptap/react';
import type { CommentReactionEmoji } from '@repo/types';
import { X } from '@repo/ui/lib/icons';
import { CommentEditorFormShell } from '@/app/comments/_components/comment-editor-form-shell';
import {
  CommentListItem,
  type AiSuggestionsRequestHandler,
} from '@/app/comments/_components/comment-list-item';
import { canUserHideComment } from '@/app/comments/_helpers/comment-visibility-storage';
import type { CommentMentionAgent } from '@/app/comments/_components/comment-mention-list';
import type { CommentUserMentionTarget } from '@/app/comments/_components/comment-content-view';
import type {
  CommentItem,
  CommentUser,
  CommentWorkItemOption,
} from '@/app/comments/_services/comments.mutations.shared';

/* eslint-disable no-unused-vars -- documents reaction toggle contract */
type ReactionToggleHandler = (
  commentId: string,
  emoji: CommentReactionEmoji,
  action: 'add' | 'remove'
) => void;
/* eslint-enable no-unused-vars */

type CommentThreadProps = {
  parent: CommentItem;
  replies: CommentItem[];
  activeUserId: string;
  showWorkItemBadge: boolean;
  editingCommentId: string | null;
  replyingParentId: string | null;
  isSubmitting: boolean;
  users: CommentUser[];
  agents: CommentMentionAgent[];
  workItems: CommentWorkItemOption[];
  currentUserName?: string | null;
  currentUserImageUrl?: string | null;
  // eslint-disable-next-line no-unused-vars -- click callback
  onUserMentionClick?: (mention: CommentUserMentionTarget) => void;
  // eslint-disable-next-line no-unused-vars -- callback signatures
  onStartEdit: (commentId: string) => void;
  onCancelEdit: () => void;
  // eslint-disable-next-line no-unused-vars -- callback signatures
  onSaveEdit: (commentId: string, doc: JSONContent) => void | Promise<void>;
  // eslint-disable-next-line no-unused-vars -- callback signatures
  onStartReply: (parentId: string) => void;
  onCancelReply: () => void;
  // eslint-disable-next-line no-unused-vars -- callback signatures
  onPostReply: (doc: JSONContent, parent: CommentItem) => Promise<void>;
  // eslint-disable-next-line no-unused-vars -- callback signatures
  onArchive: (commentId: string) => void | Promise<void>;
  // eslint-disable-next-line no-unused-vars -- callback signatures
  onRestore: (commentId: string) => void | Promise<void>;
  // eslint-disable-next-line no-unused-vars -- callback signatures
  onPurge: (commentId: string) => void;
  onToggleReaction: ReactionToggleHandler;
  // eslint-disable-next-line no-unused-vars -- callback signature
  isReactionSyncing?: (commentId: string) => boolean;
  onRequestAiSuggestions?: AiSuggestionsRequestHandler;
  hiddenCommentIds?: Set<string>;
  // eslint-disable-next-line no-unused-vars -- callback signature
  onHideComment?: (commentId: string) => void;
  // eslint-disable-next-line no-unused-vars -- callback signature
  onUnhideComment?: (commentId: string) => void;
};

function bindCommentItemHandlers(options: {
  commentId: string;
  replyParentId: string;
  // eslint-disable-next-line no-unused-vars -- callback signatures
  onStartEdit: (commentId: string) => void;
  onCancelEdit: () => void;
  // eslint-disable-next-line no-unused-vars -- callback signatures
  onSaveEdit: (commentId: string, doc: JSONContent) => void | Promise<void>;
  // eslint-disable-next-line no-unused-vars -- callback signatures
  onStartReply: (parentId: string) => void;
  onCancelReply: () => void;
  // eslint-disable-next-line no-unused-vars -- callback signatures
  onArchive: (commentId: string) => void | Promise<void>;
  // eslint-disable-next-line no-unused-vars -- callback signatures
  onRestore: (commentId: string) => void | Promise<void>;
  // eslint-disable-next-line no-unused-vars -- callback signatures
  onPurge: (commentId: string) => void;
  onToggleReaction: ReactionToggleHandler;
}) {
  return {
    onStartEdit: () => options.onStartEdit(options.commentId),
    onCancelEdit: options.onCancelEdit,
    onSaveEdit: (doc: JSONContent) => {
      options.onSaveEdit(options.commentId, doc);
    },
    onStartReply: () => {
      options.onStartReply(options.replyParentId);
    },
    onCancelReply: options.onCancelReply,
    onArchive: () => {
      options.onArchive(options.commentId);
    },
    onRestore: () => {
      options.onRestore(options.commentId);
    },
    onPurge: () => options.onPurge(options.commentId),
    onToggleReaction: (
      emoji: CommentReactionEmoji,
      action: 'add' | 'remove'
    ) => {
      options.onToggleReaction(options.commentId, emoji, action);
    },
  };
}

export function CommentThread({
  parent,
  replies,
  activeUserId,
  showWorkItemBadge,
  editingCommentId,
  replyingParentId,
  isSubmitting,
  users,
  agents,
  workItems,
  currentUserName,
  currentUserImageUrl,
  onUserMentionClick,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onStartReply,
  onCancelReply,
  onPostReply,
  onArchive,
  onRestore,
  onPurge,
  onToggleReaction,
  isReactionSyncing,
  onRequestAiSuggestions,
  hiddenCommentIds,
  onHideComment,
  onUnhideComment,
}: Readonly<CommentThreadProps>) {
  const isReplying = replyingParentId === parent.id;
  const isParentHidden = Boolean(hiddenCommentIds?.has(parent.id));
  const canHideParent = canUserHideComment(parent, activeUserId, null);

  const sharedHandlers = {
    onStartEdit,
    onCancelEdit,
    onSaveEdit,
    onStartReply,
    onCancelReply,
    onArchive,
    onRestore,
    onPurge,
    onToggleReaction,
  };

  const parentHandlers = bindCommentItemHandlers({
    commentId: parent.id,
    replyParentId: parent.id,
    ...sharedHandlers,
  });

  return (
    <div className="space-y-4">
      <CommentListItem
        comment={parent}
        activeUserId={activeUserId}
        showWorkItemBadge={showWorkItemBadge}
        isEditing={editingCommentId === parent.id}
        isReplying={isReplying}
        users={users}
        agents={agents}
        workItems={workItems}
        isReactionSyncing={isReactionSyncing?.(parent.id)}
        isHidden={isParentHidden}
        canHide={canHideParent}
        isParent
        onHide={onHideComment ? () => onHideComment(parent.id) : undefined}
        onUnhide={
          onUnhideComment ? () => onUnhideComment(parent.id) : undefined
        }
        {...parentHandlers}
        onRequestAiSuggestions={onRequestAiSuggestions}
        onUserMentionClick={onUserMentionClick}
        replySlot={
          isReplying ? (
            <CommentEditorFormShell
              className="mt-2"
              users={users}
              agents={agents}
              workItems={workItems}
              placeholder="Write a reply..."
              avatarName={currentUserName}
              avatarImageUrl={currentUserImageUrl}
              autoFocus
              submitLabel="Post reply"
              cancelLabel={
                <span className="flex items-center gap-1">
                  <X className="size-4" />
                  Cancel
                </span>
              }
              isSubmitDisabled={isSubmitting}
              onCancel={onCancelReply}
              onSubmit={(doc) => {
                onPostReply(doc, parent).catch((error) => {
                  console.error('error. failed to post reply', error);
                });
              }}
            />
          ) : null
        }
      />

      {replies.length > 0 ? (
        <div className="border-border ml-10 space-y-4 border-l pl-4">
          {replies.map((reply) => {
            const isReplyHidden = Boolean(hiddenCommentIds?.has(reply.id));
            const canHideReply = canUserHideComment(
              reply,
              activeUserId,
              parent
            );
            return (
              <CommentListItem
                key={reply.id}
                comment={reply}
                activeUserId={activeUserId}
                isEditing={editingCommentId === reply.id}
                isReplying={false}
                users={users}
                agents={agents}
                workItems={workItems}
                isReactionSyncing={isReactionSyncing?.(reply.id)}
                isHidden={isReplyHidden}
                canHide={canHideReply}
                isParent={false}
                onHide={
                  onHideComment ? () => onHideComment(reply.id) : undefined
                }
                onUnhide={
                  onUnhideComment ? () => onUnhideComment(reply.id) : undefined
                }
                {...bindCommentItemHandlers({
                  commentId: reply.id,
                  replyParentId: parent.id,
                  ...sharedHandlers,
                })}
                onRequestAiSuggestions={onRequestAiSuggestions}
                onUserMentionClick={onUserMentionClick}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
