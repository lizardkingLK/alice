'use client';

import type { JSONContent } from '@tiptap/react';
import type { CommentReactionEmoji } from '@repo/types';
import { X } from '@repo/ui/lib/icons';
import { CommentEditorFormShell } from '@/app/comments/_components/comment-editor-form-shell';
import { CommentListItem } from '@/app/comments/_components/comment-list-item';
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
}: Readonly<CommentThreadProps>) {
  const isReplying = replyingParentId === parent.id;

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
        workItems={workItems}
        isReactionSyncing={isReactionSyncing?.(parent.id)}
        {...parentHandlers}
        onUserMentionClick={onUserMentionClick}
        replySlot={
          isReplying ? (
            <CommentEditorFormShell
              className="mt-2"
              users={users}
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
          {replies.map((reply) => (
            <CommentListItem
              key={reply.id}
              comment={reply}
              activeUserId={activeUserId}
              isEditing={editingCommentId === reply.id}
              isReplying={false}
              users={users}
              workItems={workItems}
              isReactionSyncing={isReactionSyncing?.(reply.id)}
              {...bindCommentItemHandlers({
                commentId: reply.id,
                replyParentId: parent.id,
                ...sharedHandlers,
              })}
              onUserMentionClick={onUserMentionClick}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
