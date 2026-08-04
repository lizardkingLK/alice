'use client';

import type { JSONContent } from '@tiptap/react';
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
  return (
    <div className="space-y-4">
      <CommentListItem
        comment={parent}
        activeUserId={activeUserId}
        showWorkItemBadge={showWorkItemBadge}
        isEditing={editingCommentId === parent.id}
        isReplying={replyingParentId === parent.id}
        users={users}
        workItems={workItems}
        onStartEdit={() => onStartEdit(parent.id)}
        onCancelEdit={onCancelEdit}
        onSaveEdit={(doc) => {
          onSaveEdit(parent.id, doc);
        }}
        onStartReply={() => onStartReply(parent.id)}
        onCancelReply={onCancelReply}
        onArchive={() => {
          onArchive(parent.id);
        }}
        onRestore={() => {
          onRestore(parent.id);
        }}
        onPurge={() => onPurge(parent.id)}
        onQuickEmoji={() => onStartReply(parent.id)}
        onUserMentionClick={onUserMentionClick}
        replySlot={
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
                console.error('Failed to post reply:', error);
              });
            }}
          />
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
              onStartEdit={() => onStartEdit(reply.id)}
              onCancelEdit={onCancelEdit}
              onSaveEdit={(doc) => {
                onSaveEdit(reply.id, doc);
              }}
              onStartReply={() => onStartReply(parent.id)}
              onCancelReply={onCancelReply}
              onArchive={() => {
                onArchive(reply.id);
              }}
              onRestore={() => {
                onRestore(reply.id);
              }}
              onPurge={() => onPurge(reply.id)}
              onUserMentionClick={onUserMentionClick}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
