'use client';

import { useState } from 'react';
import type { JSONContent } from '@tiptap/react';
import { plainTextToCommentDoc, type Json } from '@repo/types';
import { X } from '@repo/ui/lib/icons';
import { CommentEditorFormShell } from '@/app/comments/_components/comment-editor-form-shell';
import { CommentListItem } from '@/app/comments/_components/comment-list-item';
import type { CommentUserMentionTarget } from '@/app/comments/_components/comment-content-view';
import type {
  CommentItem,
  CommentUser,
  CommentWorkItemOption,
} from '@/app/comments/_services/comments.service.base';

type MentionWorkItem = Pick<CommentWorkItemOption, 'id' | 'key' | 'title'>;

type CommentThreadProps = {
  parent: CommentItem;
  replies: CommentItem[];
  activeUserId: string;
  showWorkItemBadge: boolean;
  editingCommentId: string | null;
  replyingParentId: string | null;
  isSubmitting: boolean;
  users: CommentUser[];
  workItems: MentionWorkItem[];
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
  onBeforeStartReply?: () => void;
}) {
  return {
    onStartEdit: () => options.onStartEdit(options.commentId),
    onCancelEdit: options.onCancelEdit,
    onSaveEdit: (doc: JSONContent) => {
      options.onSaveEdit(options.commentId, doc);
    },
    onStartReply: () => {
      options.onBeforeStartReply?.();
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
}: Readonly<CommentThreadProps>) {
  const [replySeedEmoji, setReplySeedEmoji] = useState<string | null>(null);
  const isReplying = replyingParentId === parent.id;

  const clearReplySeed = () => {
    setReplySeedEmoji(null);
  };

  const handleCancelReply = () => {
    clearReplySeed();
    onCancelReply();
  };

  const sharedHandlers = {
    onStartEdit,
    onCancelEdit,
    onSaveEdit,
    onStartReply,
    onCancelReply: handleCancelReply,
    onArchive,
    onRestore,
    onPurge,
    onBeforeStartReply: clearReplySeed,
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
        {...parentHandlers}
        onQuickEmoji={(emoji) => {
          setReplySeedEmoji(emoji);
          onStartReply(parent.id);
        }}
        onUserMentionClick={onUserMentionClick}
        replySlot={
          isReplying ? (
            <CommentEditorFormShell
              key={replySeedEmoji ?? 'reply'}
              className="mt-2"
              users={users}
              workItems={workItems}
              placeholder="Write a reply..."
              initialContent={
                replySeedEmoji
                  ? (plainTextToCommentDoc(replySeedEmoji) as Json)
                  : undefined
              }
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
              onCancel={handleCancelReply}
              onSubmit={(doc) => {
                onPostReply(doc, parent)
                  .then(() => {
                    clearReplySeed();
                  })
                  .catch((error) => {
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
