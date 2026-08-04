'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import type { JSONContent } from '@tiptap/react';
import { createClient } from '@/lib/supabase/client';
import { USER_PROJECTION, isCommentDocEmpty, type Json } from '@repo/types';
import { Button } from '@repo/ui/components/ui/button';
import { Card, CardContent } from '@repo/ui/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@repo/ui/components/ui/dialog';
import { Label } from '@repo/ui/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { SearchInput } from '@/components/search-input';
import { SearchableSelect } from '@/components/searchable-select';
import { RegistryConfirmDialog } from '@/components/registry-confirm-dialog';
import { preventDismissForComboboxPortal } from '@/lib/dialog-outside-events';
import {
  MessageSquareText,
  Plus,
  MessageCircle,
  Users,
  Tag,
} from '@repo/ui/lib/icons';
import {
  CommentItem,
  CommentUser,
  CommentWorkItemOption,
  updateComment,
  archiveComment,
  restoreComment,
} from '../_services/comments.service';
import { createCommentAction } from './actions';
import { useOptimisticLock } from '@/components/optimistic-lock/optimistic-lock-provider';
import { tryHandleLockedMutationError } from '@/lib/optimistic-lock/run-locked-mutation';
import {
  CommentComposer,
  type CommentComposerHandle,
} from '@/app/comments/_components/comment-composer';
import type { CommentUserMentionTarget } from '@/app/comments/_components/comment-content-view';
import { CommentThread } from '@/app/comments/_components/comment-thread';
import {
  CommentEditor,
  type CommentEditorHandle,
} from '@/app/comments/_components/comment-editor';
import { CommentsFeedStatCard } from '@/app/comments/_components/comments-feed-stat-card';
import { CommentsSortMenu } from '@/app/comments/_components/comments-sort-menu';
import {
  computeCommentStats,
  filterComments,
  groupRepliesByParent,
  sortParentComments,
  toMentionWorkItems,
  type CommentsSortOrder,
  type CommentsStatusFilter,
} from '@/app/comments/_components/comments-feed-helpers';

type CommentsFeedProps = {
  initialComments: CommentItem[];
  workItems: CommentWorkItemOption[];
  currentUserId?: string;
  workItemId?: string;
  embedded?: boolean;
  /** When set with onSortOrderChange, sort is controlled by the parent (e.g. tab bar). */
  sortOrder?: CommentsSortOrder;
  // eslint-disable-next-line no-unused-vars -- callback signature
  onSortOrderChange?: (order: CommentsSortOrder) => void;
  /** Hide the in-feed sort control (parent renders it elsewhere). */
  hideSortControl?: boolean;
};

type WorkItemDiscussionHeaderProps = {
  embedded: boolean;
  showSortControl: boolean;
  activeCount: number;
  sortOrder: CommentsSortOrder;
  // eslint-disable-next-line no-unused-vars -- callback signature
  onSortOrderChange: (order: CommentsSortOrder) => void;
};

function WorkItemDiscussionHeader({
  embedded,
  showSortControl,
  activeCount,
  sortOrder,
  onSortOrderChange,
}: Readonly<WorkItemDiscussionHeaderProps>) {
  if (!showSortControl && embedded) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-2">
      {embedded ? (
        <span className="sr-only">Discussion</span>
      ) : (
        <h3 className="text-foreground flex items-center gap-2 text-lg font-bold">
          <MessageSquareText className="text-primary size-5" />
          Discussion ({activeCount})
        </h3>
      )}
      {showSortControl ? (
        <CommentsSortMenu
          sortOrder={sortOrder}
          onSortOrderChange={onSortOrderChange}
        />
      ) : null}
    </div>
  );
}

async function loadActiveCommentUsers(): Promise<CommentUser[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('users')
    .select(USER_PROJECTION)
    .eq('status', 'active')
    .order('name');
  // Defense in depth: only active users are mentionable.
  return ((data as CommentUser[] | null) ?? []).filter(Boolean);
}

export function CommentsFeed({
  initialComments,
  workItems,
  currentUserId,
  workItemId,
  embedded = false,
  sortOrder: controlledSortOrder,
  onSortOrderChange,
  hideSortControl = false,
}: Readonly<CommentsFeedProps>) {
  const [comments, setComments] = useState<CommentItem[]>(initialComments);
  const [users, setUsers] = useState<CommentUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorkItemId, setSelectedWorkItemId] = useState('all');
  const [selectedStatus, setSelectedStatus] =
    useState<CommentsStatusFilter>('active');
  const [uncontrolledSortOrder, setUncontrolledSortOrder] =
    useState<CommentsSortOrder>('newest');
  const sortOrder = controlledSortOrder ?? uncontrolledSortOrder;
  const setSortOrder = onSortOrderChange ?? setUncontrolledSortOrder;
  const showSortControl = !hideSortControl;
  const [showNewCommentModal, setShowNewCommentModal] = useState(false);
  const [newWorkItemId, setNewWorkItemId] = useState(workItemId || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyingParentId, setReplyingParentId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const modalEditorRef = useRef<CommentEditorHandle | null>(null);
  const composerRef = useRef<CommentComposerHandle | null>(null);
  const pendingUserMentionRef = useRef<CommentUserMentionTarget | null>(null);

  const { handleMutationError } = useOptimisticLock();
  const activeUserId = currentUserId ?? '';
  const currentUser = users.find((u) => u.id === activeUserId);
  const currentUserName = currentUser?.name ?? 'You';
  const currentUserImageUrl = currentUser?.profile_picture ?? null;

  const handleUserMentionClick = (mention: CommentUserMentionTarget) => {
    if (workItemId) {
      composerRef.current?.insertUserMention(mention);
      return;
    }

    pendingUserMentionRef.current = mention;
    setShowNewCommentModal(true);
  };

  useEffect(() => {
    if (!showNewCommentModal || !pendingUserMentionRef.current) {
      return;
    }
    const mention = pendingUserMentionRef.current;
    const timer = window.setTimeout(() => {
      modalEditorRef.current?.insertUserMention(mention);
      modalEditorRef.current?.focus();
      pendingUserMentionRef.current = null;
    }, 50);
    return () => window.clearTimeout(timer);
  }, [showNewCommentModal]);

  useEffect(() => {
    setComments(initialComments);
  }, [initialComments]);

  useEffect(() => {
    if (workItemId) {
      setNewWorkItemId(workItemId);
    }
  }, [workItemId]);

  useEffect(() => {
    loadActiveCommentUsers()
      .then(setUsers)
      .catch((error) => {
        console.error('error. failed to load comment users', error);
      });
  }, []);

  const stats = useMemo(() => computeCommentStats(comments), [comments]);

  const filteredComments = useMemo(
    () =>
      filterComments(comments, {
        workItemId,
        selectedWorkItemId,
        selectedStatus,
        searchQuery,
      }),
    [comments, workItemId, selectedWorkItemId, selectedStatus, searchQuery]
  );

  const parentComments = useMemo(
    () => sortParentComments(filteredComments, sortOrder),
    [filteredComments, sortOrder]
  );

  const repliesByParent = useMemo(
    () => groupRepliesByParent(filteredComments),
    [filteredComments]
  );

  const mentionWorkItems = useMemo(
    () => toMentionWorkItems(workItems),
    [workItems]
  );

  const handleCreateComment = async (
    doc: JSONContent,
    parentId?: string,
    fallbackWorkItemId?: string
  ) => {
    const targetWorkItemId = workItemId || fallbackWorkItemId || newWorkItemId;
    if (!targetWorkItemId || isCommentDocEmpty(doc as Json)) {
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createCommentAction({
        work_item_id: targetWorkItemId,
        content: doc as Json,
        parent_id: parentId ?? null,
      });
      if (!res.success) {
        throw new Error(res.error || 'Failed to create comment');
      }
      setComments((prev) => [res.data!, ...prev]);
      setShowNewCommentModal(false);
      setReplyingParentId(null);
    } catch (err) {
      console.error('error. failed to create comment', err);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCommentLockedError = async (options: {
    error: unknown;
    commentId: string;
    expectedUpdatedAt: string;
    pendingFields: Record<string, unknown>;
    fallbackMessage: string;
  }) => {
    if (
      await tryHandleLockedMutationError({
        error: options.error,
        handleMutationError,
        entityType: 'comment',
        entityId: options.commentId,
        expectedUpdatedAt: options.expectedUpdatedAt,
        pendingFields: options.pendingFields,
        currentUserId: activeUserId,
      })
    ) {
      return true;
    }
    console.error(options.fallbackMessage, options.error);
    return false;
  };

  const handleSaveEdit = async (commentId: string, doc: JSONContent) => {
    const targetComment = comments.find((c) => c.id === commentId);
    if (!targetComment || isCommentDocEmpty(doc as Json)) {
      return;
    }

    const expectedUpdatedAt = targetComment.updated_at;
    try {
      const updated = await updateComment(
        commentId,
        doc as Json,
        expectedUpdatedAt
      );
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? updated : c))
      );
    } catch (err) {
      await handleCommentLockedError({
        error: err,
        commentId,
        expectedUpdatedAt,
        pendingFields: { content: doc },
        fallbackMessage: 'error. failed to update comment',
      });
    } finally {
      setEditingCommentId(null);
    }
  };

  const updateCommentStatusLocal = (
    commentId: string,
    status: 'active' | 'archived'
  ) => {
    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, status } : c))
    );
  };

  const mutateCommentStatus = async (
    commentId: string,
    nextStatus: 'active' | 'archived',
    // eslint-disable-next-line no-unused-vars -- callback signature
    apiCall: (id: string, updatedAt: string) => Promise<unknown>
  ) => {
    const targetComment = comments.find((c) => c.id === commentId);
    if (!targetComment) {
      return;
    }
    try {
      await apiCall(commentId, targetComment.updated_at);
      updateCommentStatusLocal(commentId, nextStatus);
    } catch (err) {
      await handleCommentLockedError({
        error: err,
        commentId,
        expectedUpdatedAt: targetComment.updated_at,
        pendingFields: { status: nextStatus },
        fallbackMessage: `error. failed to ${nextStatus === 'archived' ? 'archive' : 'restore'} comment`,
      });
    }
  };

  const handleArchive = (commentId: string) =>
    mutateCommentStatus(commentId, 'archived', archiveComment);

  const handleRestore = (commentId: string) =>
    mutateCommentStatus(commentId, 'active', restoreComment);

  const confirmDelete = async () => {
    if (!deletingCommentId) {
      return;
    }
    const targetComment = comments.find((c) => c.id === deletingCommentId);
    if (!targetComment) {
      return;
    }
    setIsDeleting(true);
    try {
      await archiveComment(deletingCommentId, targetComment.updated_at, true);
      setComments((prev) => prev.filter((c) => c.id !== deletingCommentId));
    } catch (err) {
      console.error('error. failed to delete comment permanently', err);
    } finally {
      setIsDeleting(false);
      setDeletingCommentId(null);
    }
  };

  const submitModalComment = async () => {
    if (!modalEditorRef.current || modalEditorRef.current.isEmpty()) {
      return;
    }
    await handleCreateComment(modalEditorRef.current.getJSON());
  };

  const startReply = (parentId: string) => {
    setReplyingParentId(parentId);
  };

  const cancelReply = () => {
    setReplyingParentId(null);
  };

  const postReply = async (doc: JSONContent, parent: CommentItem) => {
    await handleCreateComment(doc, parent.id, parent.work_item_id);
  };

  const renderParentThreads = (showWorkItemBadge: boolean) =>
    parentComments.map((parent) => (
      <CommentThread
        key={parent.id}
        parent={parent}
        replies={repliesByParent.get(parent.id) ?? []}
        activeUserId={activeUserId}
        showWorkItemBadge={showWorkItemBadge}
        editingCommentId={editingCommentId}
        replyingParentId={replyingParentId}
        isSubmitting={isSubmitting}
        users={users}
        workItems={mentionWorkItems}
        currentUserName={currentUserName}
        currentUserImageUrl={currentUserImageUrl}
        onUserMentionClick={handleUserMentionClick}
        onStartEdit={setEditingCommentId}
        onCancelEdit={() => setEditingCommentId(null)}
        onSaveEdit={handleSaveEdit}
        onStartReply={startReply}
        onCancelReply={cancelReply}
        onPostReply={postReply}
        onArchive={handleArchive}
        onRestore={handleRestore}
        onPurge={setDeletingCommentId}
      />
    ));

  return (
    <div className="space-y-6">
      {!workItemId && (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-foreground text-2xl font-bold tracking-tight">
                Discussions & Comments
              </h1>
              <p className="text-muted-foreground text-sm">
                Collaborate, review feedback, and track conversation threads
                across all project work items.
              </p>
            </div>
            <Button onClick={() => setShowNewCommentModal(true)}>
              <Plus className="size-4" />
              New Comment
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <CommentsFeedStatCard
              label="Total Comments"
              value={stats.total}
              icon={<MessageSquareText className="size-5" />}
              iconClassName="bg-primary/10 text-primary"
            />
            <CommentsFeedStatCard
              label="Active Discussions"
              value={stats.active}
              icon={<MessageCircle className="size-5" />}
              iconClassName="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            />
            <CommentsFeedStatCard
              label="Contributors"
              value={stats.authors}
              icon={<Users className="size-5" />}
              iconClassName="bg-violet-500/10 text-violet-600 dark:text-violet-400"
            />
            <CommentsFeedStatCard
              label="Discussed Items"
              value={stats.workItemsDiscussed}
              icon={<Tag className="size-5" />}
              iconClassName="bg-amber-500/10 text-amber-600 dark:text-amber-400"
            />
          </div>

          <Card>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <SearchInput
                value={searchQuery}
                onValueChange={setSearchQuery}
                placeholder="Search comments by text, author, or issue key..."
                className="w-full sm:max-w-70 md:max-w-90"
              />
              <div className="flex w-full flex-row items-center gap-2 sm:w-auto">
                <SearchableSelect
                  id="select-work-item-filter"
                  value={selectedWorkItemId}
                  onValueChange={setSelectedWorkItemId}
                  ariaLabel="Filter by Work Item"
                  placeholder="All Work Items"
                  className="w-1/2 sm:w-44"
                  options={[
                    { value: 'all', label: 'All Work Items' },
                    ...workItems.map((item) => ({
                      value: item.id,
                      label: `${item.key} — ${item.title.slice(0, 25)}${item.title.length > 25 ? '…' : ''}`,
                    })),
                  ]}
                />
                <Select
                  value={selectedStatus}
                  onValueChange={(value) =>
                    setSelectedStatus(value as CommentsStatusFilter)
                  }
                >
                  <SelectTrigger
                    id="select-status-filter"
                    aria-label="Filter by Status"
                    className="w-1/2 sm:w-44"
                  >
                    <SelectValue placeholder="Active Comments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active Comments</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                    <SelectItem value="all">All Statuses</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {workItemId ? (
        <div className="space-y-4 pb-2">
          <WorkItemDiscussionHeader
            embedded={embedded}
            showSortControl={showSortControl}
            activeCount={stats.active}
            sortOrder={sortOrder}
            onSortOrderChange={setSortOrder}
          />

          <CommentComposer
            ref={composerRef}
            currentUserName={currentUserName}
            currentUserImageUrl={currentUserImageUrl}
            users={users}
            workItems={mentionWorkItems}
            isSubmitting={isSubmitting}
            enableMShortcut={embedded}
            onSubmit={(doc) => handleCreateComment(doc)}
          />

          <div className="space-y-6 pb-2">{renderParentThreads(false)}</div>
        </div>
      ) : (
        <div className="space-y-4">
          {parentComments.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="space-y-3 py-12 text-center">
                <div className="bg-muted mx-auto flex size-12 items-center justify-center rounded-full">
                  <MessageSquareText className="text-muted-foreground size-6" />
                </div>
                <h3 className="text-foreground text-base font-semibold">
                  No comments found
                </h3>
                <p className="text-muted-foreground mx-auto max-w-sm text-sm">
                  {searchQuery || selectedWorkItemId !== 'all'
                    ? 'Try adjusting your search query or filter settings.'
                    : 'Be the first to start a conversation!'}
                </p>
                <Button
                  onClick={() => setShowNewCommentModal(true)}
                  variant="outline"
                  className="mt-2"
                >
                  <Plus className="size-4" />
                  Add Comment
                </Button>
              </CardContent>
            </Card>
          ) : (
            renderParentThreads(true)
          )}
        </div>
      )}

      <Dialog open={showNewCommentModal} onOpenChange={setShowNewCommentModal}>
        <DialogContent
          className="sm:max-w-125"
          onPointerDownOutside={preventDismissForComboboxPortal}
          onInteractOutside={preventDismissForComboboxPortal}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquareText className="text-primary size-5" />
              Post New Comment
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="new-comment-work-item-select">
                Select Work Item
              </Label>
              <SearchableSelect
                id="new-comment-work-item-select"
                value={newWorkItemId}
                onValueChange={setNewWorkItemId}
                placeholder="Search work items…"
                options={workItems.map((item) => ({
                  value: item.id,
                  label: `[${item.key}] ${item.title}`,
                }))}
                emptyText="No matching work items."
              />
            </div>

            <div className="space-y-2">
              <Label>Comment Text</Label>
              <div className="border-border rounded-lg border">
                <CommentEditor
                  ref={modalEditorRef}
                  users={users}
                  workItems={mentionWorkItems}
                  placeholder="Share your thoughts, feedback, or update..."
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowNewCommentModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={isSubmitting || !newWorkItemId}
                onClick={() => {
                  submitModalComment().catch((error) => {
                    console.error('error. failed to post comment', error);
                  });
                }}
              >
                {isSubmitting ? 'Posting...' : 'Post Comment'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {deletingCommentId !== null ? (
        <RegistryConfirmDialog
          title="Confirm Purge"
          subject="this comment"
          detail="This action cannot be undone and will permanently remove the comment record from the database."
          confirmLabel="Purge Comment"
          pendingLabel="Purging..."
          isPending={isDeleting}
          isSoft={false}
          onCancel={() => setDeletingCommentId(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </div>
  );
}
