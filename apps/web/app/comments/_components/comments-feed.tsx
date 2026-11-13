'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { JSONContent } from '@tiptap/react';
import { createClient } from '@/lib/supabase/client';
import {
  USER_PROJECTION_WITH_ROLE,
  isCommentDocEmpty,
  type CommentReactionEmoji,
  type Json,
  type WorkItemAiProposalSuggestion,
} from '@repo/types';
import { toast } from '@repo/ui/components/ui/sonner';
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
import { preventDismissForFloatingPortal } from '@/lib/dialog-outside-events';
import {
  MessageSquareText,
  Plus,
  MessageCircle,
  Users,
  Tag,
  Loader2,
  Eye,
  EyeOff,
} from '@repo/ui/lib/icons';
import {
  CommentItem,
  CommentUser,
  CommentWorkItemOption,
  updateComment,
  archiveComment,
  restoreComment,
  toggleCommentReaction,
} from '../_services/comments.mutations.client';
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
import type { CommentMentionAgent } from '@/app/comments/_components/comment-mention-list';
import { listChatAgentsClient } from '@/app/chat/_services/chat-agents.reads.client';
import { CommentsFeedStatCard } from '@/app/comments/_components/comments-feed-stat-card';
import { CommentsSortMenu } from '@/app/comments/_components/comments-sort-menu';
import {
  computeCommentStats,
  filterComments,
  groupRepliesByParent,
  sortParentComments,
  toMentionWorkItems,
  scopeMentionWorkItems,
  uniqueCommentsById,
  upsertCommentById,
  type CommentsSortOrder,
  type CommentsStatusFilter,
} from '@/app/comments/_components/comments-feed-helpers';
import {
  applyRealtimeCommentChange,
  type CommentRealtimeRow,
} from '@/app/comments/_helpers/apply-realtime-comment-row';
import { createCommentReactionMutationQueue } from '@/app/comments/_helpers/comment-reaction-mutation-queue';
import { toggleIdInSet } from '@/lib/work-items/toggle-id-in-set';
import { usePendingMutationUnload } from '@/lib/work-items/use-pending-mutation-unload';
import { rowFromRealtimePayload } from '@/lib/realtime/realtime-change-row';
import { useScopedTableRealtime } from '@/lib/realtime/use-scoped-table-realtime';
import { WorkItemAiProposalCard } from '@/app/work-items/_components/work-item-details/work-item-ai-proposal-card';
import { generateWorkItemAiProposals } from '@/app/work-items/_services/work-item-ai-proposals.client';
import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';
import {
  readHiddenCommentIds,
  hideCommentForUser,
  unhideCommentForUser,
  filterVisibleComments,
} from '@/app/comments/_helpers/comment-visibility-storage';

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
  currentWorkItemTitle?: string;
  currentWorkItemUpdatedAt?: string;
  // eslint-disable-next-line no-unused-vars -- callback signature
  onWorkItemPatched?: (updated: Partial<DbWorkItem>) => void;
  readOnly?: boolean;
};

type WorkItemDiscussionHeaderProps = {
  embedded: boolean;
  showSortControl: boolean;
  activeCount: number;
  sortOrder: CommentsSortOrder;
  // eslint-disable-next-line no-unused-vars -- callback signature
  onSortOrderChange: (order: CommentsSortOrder) => void;
  hiddenCount?: number;
  showHidden?: boolean;
  onToggleShowHidden?: () => void;
};

function HiddenCommentsToggleButton({
  hiddenCount,
  showHidden,
  onToggle,
}: Readonly<{
  hiddenCount: number;
  showHidden: boolean;
  onToggle: () => void;
}>) {
  if (hiddenCount <= 0) return null;
  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      className="text-muted-foreground hover:text-foreground gap-1.5 text-xs"
      data-testid="toggle-hidden-comments-btn"
      onClick={onToggle}
    >
      {showHidden ? (
        <>
          <EyeOff className="size-3.5" />
          Hide hidden items
        </>
      ) : (
        <>
          <Eye className="size-3.5" />
          {hiddenCount} {hiddenCount === 1 ? 'item' : 'items'} hidden for you
        </>
      )}
    </Button>
  );
}

function WorkItemDiscussionHeader({
  embedded,
  showSortControl,
  activeCount,
  sortOrder,
  onSortOrderChange,
  hiddenCount = 0,
  showHidden = false,
  onToggleShowHidden,
}: Readonly<WorkItemDiscussionHeaderProps>) {
  const hasHiddenButton = hiddenCount > 0 && Boolean(onToggleShowHidden);
  if (!showSortControl && embedded && !hasHiddenButton) {
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
      <div className="flex items-center gap-2">
        {onToggleShowHidden ? (
          <HiddenCommentsToggleButton
            hiddenCount={hiddenCount}
            showHidden={showHidden}
            onToggle={onToggleShowHidden}
          />
        ) : null}
        {showSortControl ? (
          <CommentsSortMenu
            sortOrder={sortOrder}
            onSortOrderChange={onSortOrderChange}
          />
        ) : null}
      </div>
    </div>
  );
}

function collectUserIds(ownerIds: string[], memberIds: string[]): Set<string> {
  const userIds = new Set<string>();
  for (const id of ownerIds) {
    if (id) userIds.add(id);
  }
  for (const id of memberIds) {
    if (id) userIds.add(id);
  }
  return userIds;
}

async function fetchSortedUsersForIds(
  supabase: ReturnType<typeof createClient>,
  userIds: Set<string>
): Promise<CommentUser[]> {
  if (userIds.size === 0) return [];
  const { data: fetchedUsers } = await supabase
    .from('users')
    .select(USER_PROJECTION_WITH_ROLE)
    .eq('status', 'active')
    .in('id', Array.from(userIds));
  const users =
    fetchedUsers && Array.isArray(fetchedUsers)
      ? (fetchedUsers as CommentUser[])
      : [];
  return [...users].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

async function loadProjectCommentUsers(
  supabase: ReturnType<typeof createClient>,
  projectId: string
): Promise<CommentUser[]> {
  const [projectRes, membersRes] = await Promise.all([
    supabase
      .from('projects')
      .select('owner_id')
      .eq('id', projectId)
      .maybeSingle(),
    supabase
      .from('project_members')
      .select('user_id')
      .eq('project_id', projectId)
      .eq('status', 'active'),
  ]);

  const ownerIds = projectRes.data?.owner_id ? [projectRes.data.owner_id] : [];
  const memberIds =
    (membersRes.data as { user_id: string }[])
      ?.map((m) => m.user_id)
      .filter(Boolean) ?? [];

  return fetchSortedUsersForIds(supabase, collectUserIds(ownerIds, memberIds));
}

async function loadGlobalCommentUsers(
  supabase: ReturnType<typeof createClient>
): Promise<CommentUser[]> {
  const [projectsRes, membersRes] = await Promise.all([
    supabase.from('projects').select('owner_id').eq('status', 'active'),
    supabase.from('project_members').select('user_id').eq('status', 'active'),
  ]);

  const ownerIds =
    (projectsRes.data as { owner_id: string }[])
      ?.map((p) => p.owner_id)
      .filter(Boolean) ?? [];
  const memberIds =
    (membersRes.data as { user_id: string }[])
      ?.map((m) => m.user_id)
      .filter(Boolean) ?? [];

  return fetchSortedUsersForIds(supabase, collectUserIds(ownerIds, memberIds));
}

export async function loadActiveCommentUsers(
  workItemId?: string
): Promise<CommentUser[]> {
  const supabase = createClient();

  try {
    if (workItemId && workItemId !== 'all') {
      const { data: workItem } = await supabase
        .from('work_items')
        .select('project_id')
        .eq('id', workItemId)
        .maybeSingle();

      const projectId = workItem?.project_id;
      if (projectId) {
        return await loadProjectCommentUsers(supabase, projectId);
      }
    }

    return await loadGlobalCommentUsers(supabase);
  } catch (error) {
    console.error('error. failed to load work item mention users', error);
    const { data } = await supabase
      .from('users')
      .select(USER_PROJECTION_WITH_ROLE)
      .eq('status', 'active')
      .order('name');
    return ((data as CommentUser[] | null) ?? []).filter(Boolean);
  }
}

function resolveTargetWorkItemId(
  workItemId?: string,
  newWorkItemId?: string,
  selectedWorkItemId?: string
): string | undefined {
  if (workItemId) return workItemId;
  if (newWorkItemId && newWorkItemId !== 'all') return newWorkItemId;
  if (selectedWorkItemId && selectedWorkItemId !== 'all')
    return selectedWorkItemId;
  return undefined;
}

type CommentsFeedProposalSectionProps = {
  readonly proposalState:
    | { status: 'idle' }
    | { status: 'generating'; agentName: string; commentId: string }
    | {
        status: 'ready';
        agentName: string;
        suggestions: WorkItemAiProposalSuggestion[];
        commentId: string;
      }
    | { status: 'error'; agentName: string; error: string; commentId: string };
  readonly workItemId?: string;
  readonly currentWorkItemTitle?: string;
  readonly currentWorkItemUpdatedAt?: string;
  // eslint-disable-next-line no-unused-vars -- callback signature
  readonly onWorkItemPatched?: (updated: Partial<DbWorkItem>) => void;
  readonly onDismiss: () => void;
  readonly onRefresh: () => void;
};

function CommentsFeedProposalSection({
  proposalState,
  workItemId,
  currentWorkItemTitle,
  currentWorkItemUpdatedAt,
  onWorkItemPatched,
  onDismiss,
  onRefresh,
}: Readonly<CommentsFeedProposalSectionProps>) {
  if (proposalState.status === 'idle') {
    return null;
  }

  if (proposalState.status === 'generating') {
    return (
      <div
        className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-950 dark:text-emerald-300"
        data-testid="ai-proposal-loading"
      >
        <Loader2 className="size-4 animate-spin text-emerald-600 dark:text-emerald-400" />
        <span>Generating suggestions from @{proposalState.agentName}…</span>
      </div>
    );
  }

  if (proposalState.status === 'ready') {
    return (
      <WorkItemAiProposalCard
        agentName={proposalState.agentName}
        suggestions={proposalState.suggestions}
        workItemId={workItemId ?? ''}
        currentTitle={currentWorkItemTitle}
        expectedUpdatedAt={currentWorkItemUpdatedAt ?? ''}
        onApplySuccess={(updated) => {
          onWorkItemPatched?.(updated);
          toast.success('Work item updated from AI suggestions');
          onRefresh();
        }}
        onReject={onDismiss}
      />
    );
  }

  return (
    <div
      className="border-destructive/30 bg-destructive/5 text-destructive flex items-center justify-between gap-2 rounded-lg border p-3 text-xs"
      data-testid="ai-proposal-generation-error"
    >
      <span>
        Failed to get suggestions from @{proposalState.agentName}:{' '}
        {proposalState.error}
      </span>
      <Button type="button" variant="ghost" size="xs" onClick={onDismiss}>
        Dismiss
      </Button>
    </div>
  );
}

function CommentsFeedEmptyState({
  hasFilters,
  onOpenNewCommentModal,
}: Readonly<{
  hasFilters: boolean;
  onOpenNewCommentModal: () => void;
}>) {
  return (
    <Card className="border-dashed">
      <CardContent className="space-y-3 py-12 text-center">
        <div className="bg-muted mx-auto flex size-12 items-center justify-center rounded-full">
          <MessageSquareText className="text-muted-foreground size-6" />
        </div>
        <h3 className="text-foreground text-base font-semibold">
          No comments found
        </h3>
        <p className="text-muted-foreground mx-auto max-w-sm text-sm">
          {hasFilters
            ? 'Try adjusting your search query or filter settings.'
            : 'Be the first to start a conversation!'}
        </p>
        <Button
          onClick={onOpenNewCommentModal}
          variant="outline"
          className="mt-2"
        >
          <Plus className="size-4" />
          Add Comment
        </Button>
      </CardContent>
    </Card>
  );
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
  currentWorkItemTitle,
  currentWorkItemUpdatedAt,
  onWorkItemPatched,
  readOnly = false,
}: Readonly<CommentsFeedProps>) {
  const router = useRouter();
  const [comments, setComments] = useState<CommentItem[]>(initialComments);
  const [users, setUsers] = useState<CommentUser[]>([]);
  const [agents, setAgents] = useState<CommentMentionAgent[]>([]);
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
  const [proposalState, setProposalState] = useState<
    | { status: 'idle' }
    | { status: 'generating'; agentName: string; commentId: string }
    | {
        status: 'ready';
        agentName: string;
        suggestions: WorkItemAiProposalSuggestion[];
        commentId: string;
      }
    | { status: 'error'; agentName: string; error: string; commentId: string }
  >({ status: 'idle' });
  const [hiddenCommentIds, setHiddenCommentIds] = useState<Set<string>>(() =>
    readHiddenCommentIds(currentUserId)
  );
  const [showHidden, setShowHidden] = useState(false);

  useEffect(() => {
    setHiddenCommentIds(readHiddenCommentIds(currentUserId));
    setProposalState({ status: 'idle' });
  }, [currentUserId]);

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
  const commentsRef = useRef(comments);
  const activeUserIdRef = useRef(currentUserId ?? '');
  const [reactionSyncingIds, setReactionSyncingIds] = useState(
    () => new Set<string>()
  );

  const { handleMutationError } = useOptimisticLock();
  const activeUserId = currentUserId ?? '';
  commentsRef.current = comments;
  activeUserIdRef.current = activeUserId;
  const currentUser = users.find((u) => u.id === activeUserId);
  const currentUserName = currentUser?.name ?? 'You';
  const currentUserImageUrl = currentUser?.profile_picture ?? null;

  const reactionQueue = useMemo(
    () =>
      createCommentReactionMutationQueue({
        getUserId: () => activeUserIdRef.current || undefined,
        setComments,
        getComment: (commentId) =>
          commentsRef.current.find((comment) => comment.id === commentId),
        sendToggle: async (commentId, emoji, action, sendOptions) => {
          const updated = await toggleCommentReaction(
            commentId,
            emoji,
            action,
            { keepalive: sendOptions?.keepalive }
          );
          return {
            commentId,
            reactions: (updated.reactions ?? []) as Json,
            updated_at: updated.updated_at,
          };
        },
        onPendingChange: (commentId, isPending) => {
          setReactionSyncingIds((prev) =>
            toggleIdInSet(prev, commentId, isPending)
          );
        },
      }),
    []
  );

  usePendingMutationUnload(reactionQueue);

  const targetWorkItemId = resolveTargetWorkItemId(
    workItemId,
    newWorkItemId,
    selectedWorkItemId
  );

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
    loadActiveCommentUsers(targetWorkItemId)
      .then(setUsers)
      .catch((error) => {
        console.error('error. failed to load comment users', error);
      });
  }, [targetWorkItemId]);

  useEffect(() => {
    listChatAgentsClient({ status: 'active' })
      .then(setAgents)
      .catch((error) => {
        console.error('error. failed to load comment mention agents', error);
        setAgents([]);
      });
  }, []);

  useScopedTableRealtime<CommentRealtimeRow>({
    enabled: Boolean(workItemId),
    channelPrefix: 'wi-comments',
    table: 'comments',
    scopeKey: workItemId ?? '',
    filter: workItemId ? `work_item_id=eq.${workItemId}` : undefined,
    onChange: ({ eventType, new: nextRow, old: prevRow }) => {
      setComments((prev) => {
        const row = rowFromRealtimePayload(eventType, nextRow, prevRow);
        return (
          applyRealtimeCommentChange(prev, eventType, row, users, {
            isReactionFlushPending: (commentId) =>
              reactionQueue.isPending(commentId),
          }) ?? prev
        );
      });
    },
  });

  const stats = useMemo(() => computeCommentStats(comments), [comments]);

  const filteredComments = useMemo(
    () =>
      uniqueCommentsById(
        filterComments(comments, {
          workItemId,
          selectedWorkItemId,
          selectedStatus,
          searchQuery,
        })
      ),
    [comments, workItemId, selectedWorkItemId, selectedStatus, searchQuery]
  );

  const visibleComments = useMemo(
    () => filterVisibleComments(filteredComments, hiddenCommentIds, showHidden),
    [filteredComments, hiddenCommentIds, showHidden]
  );

  const parentComments = useMemo(
    () => sortParentComments(visibleComments, sortOrder),
    [visibleComments, sortOrder]
  );

  const repliesByParent = useMemo(
    () => groupRepliesByParent(visibleComments),
    [visibleComments]
  );

  const hiddenCount = useMemo(() => {
    if (hiddenCommentIds.size === 0) return 0;
    return filteredComments.filter((c) => hiddenCommentIds.has(c.id)).length;
  }, [filteredComments, hiddenCommentIds]);

  const scopedWorkItems = useMemo(
    () => scopeMentionWorkItems(workItems, targetWorkItemId),
    [workItems, targetWorkItemId]
  );

  const mentionWorkItems = useMemo(
    () => toMentionWorkItems(scopedWorkItems),
    [scopedWorkItems]
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
      // Upsert: realtime INSERT may have already prepended this id.
      setComments((prev) => upsertCommentById(prev, res.data!));
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
      const result = await apiCall(commentId, targetComment.updated_at);
      if (
        nextStatus === 'archived' &&
        result &&
        typeof result === 'object' &&
        'message' in result &&
        typeof result.message === 'string'
      ) {
        toast.success(result.message);
      }
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
      const accepted = await archiveComment(
        deletingCommentId,
        targetComment.updated_at,
        true
      );
      toast.success(accepted.message);
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

  const handleToggleReaction = (
    commentId: string,
    emoji: CommentReactionEmoji,
    action: 'add' | 'remove'
  ) => {
    reactionQueue.enqueue(commentId, emoji, action);
  };

  const handleRequestAiSuggestions = async (
    agentId: string,
    agentLabel: string,
    commentId: string
  ) => {
    if (!workItemId || readOnly) return;
    setProposalState({
      status: 'generating',
      agentName: agentLabel,
      commentId,
    });

    try {
      const response = await generateWorkItemAiProposals(workItemId, {
        agentId,
        commentIds: [commentId],
      });
      setProposalState({
        status: 'ready',
        agentName: agentLabel,
        suggestions: response.suggestions,
        commentId,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to generate suggestions from AI agent.';
      setProposalState({
        status: 'error',
        agentName: agentLabel,
        error: message,
        commentId,
      });
    }
  };

  const handleHideComment = (commentId: string) => {
    const updated = hideCommentForUser(activeUserId, commentId);
    setHiddenCommentIds(new Set(updated));
    if (proposalState.status !== 'idle' && 'commentId' in proposalState) {
      const isDirectMatch = proposalState.commentId === commentId;
      const isChildOfHiddenParent = comments.some(
        (c) => c.id === proposalState.commentId && c.parent_id === commentId
      );
      if (isDirectMatch || isChildOfHiddenParent) {
        setProposalState({ status: 'idle' });
      }
    }
    toast.success('Discussion item hidden from your view');
  };

  const handleUnhideComment = (commentId: string) => {
    const updated = unhideCommentForUser(activeUserId, commentId);
    setHiddenCommentIds(new Set(updated));
    toast.success('Discussion item unhidden');
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
        agents={agents}
        workItems={scopedWorkItems}
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
        onToggleReaction={handleToggleReaction}
        isReactionSyncing={(commentId) => reactionSyncingIds.has(commentId)}
        onRequestAiSuggestions={handleRequestAiSuggestions}
        hiddenCommentIds={hiddenCommentIds}
        onHideComment={handleHideComment}
        onUnhideComment={handleUnhideComment}
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
            hiddenCount={hiddenCount}
            showHidden={showHidden}
            onToggleShowHidden={() => setShowHidden((prev) => !prev)}
          />

          <CommentComposer
            ref={composerRef}
            currentUserName={currentUserName}
            currentUserImageUrl={currentUserImageUrl}
            users={users}
            agents={agents}
            workItems={mentionWorkItems}
            isSubmitting={isSubmitting}
            enableMShortcut={embedded}
            onSubmit={(doc) => handleCreateComment(doc)}
          />

          <CommentsFeedProposalSection
            proposalState={proposalState}
            workItemId={workItemId}
            currentWorkItemTitle={currentWorkItemTitle}
            currentWorkItemUpdatedAt={currentWorkItemUpdatedAt}
            onWorkItemPatched={onWorkItemPatched}
            onDismiss={() => setProposalState({ status: 'idle' })}
            onRefresh={() => router.refresh()}
          />

          <div className="space-y-6 pb-2">{renderParentThreads(false)}</div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <HiddenCommentsToggleButton
              hiddenCount={hiddenCount}
              showHidden={showHidden}
              onToggle={() => setShowHidden((prev) => !prev)}
            />
          </div>
          {parentComments.length === 0 ? (
            <CommentsFeedEmptyState
              hasFilters={Boolean(searchQuery || selectedWorkItemId !== 'all')}
              onOpenNewCommentModal={() => setShowNewCommentModal(true)}
            />
          ) : (
            renderParentThreads(true)
          )}
        </div>
      )}

      <Dialog open={showNewCommentModal} onOpenChange={setShowNewCommentModal}>
        <DialogContent
          className="sm:max-w-125"
          onPointerDownOutside={preventDismissForFloatingPortal}
          onInteractOutside={preventDismissForFloatingPortal}
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
                  agents={agents}
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
