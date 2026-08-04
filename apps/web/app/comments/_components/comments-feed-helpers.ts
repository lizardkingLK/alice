import { commentContentToPlainText, type Json } from '@repo/types';
import type {
  CommentItem,
  CommentWorkItemOption,
} from '@/app/comments/_services/comments.service.base';

export type CommentsSortOrder = 'newest' | 'oldest';

export type CommentsStatusFilter = 'all' | 'active' | 'archived';

export type CommentsFeedFilters = {
  workItemId?: string;
  selectedWorkItemId: string;
  selectedStatus: CommentsStatusFilter;
  searchQuery: string;
};

export function computeCommentStats(comments: CommentItem[]) {
  const active = comments.filter((c) => c.status === 'active');
  return {
    total: comments.length,
    active: active.length,
    authors: new Set(comments.map((c) => c.author_id)).size,
    workItemsDiscussed: new Set(comments.map((c) => c.work_item_id)).size,
  };
}

export function filterComments(
  comments: CommentItem[],
  filters: CommentsFeedFilters
): CommentItem[] {
  const q = filters.searchQuery.toLowerCase().trim();

  return comments.filter((c) => {
    if (filters.workItemId && c.work_item_id !== filters.workItemId) {
      return false;
    }
    if (
      filters.selectedWorkItemId !== 'all' &&
      c.work_item_id !== filters.selectedWorkItemId
    ) {
      return false;
    }
    if (
      !filters.workItemId &&
      filters.selectedStatus !== 'all' &&
      c.status !== filters.selectedStatus
    ) {
      return false;
    }
    if (!q) {
      return true;
    }
    const plain = commentContentToPlainText(c.content).toLowerCase();
    const author = c.author?.name?.toLowerCase() ?? '';
    const key = c.work_item?.key?.toLowerCase() ?? '';
    return plain.includes(q) || author.includes(q) || key.includes(q);
  });
}

export function sortParentComments(
  comments: CommentItem[],
  sortOrder: CommentsSortOrder
): CommentItem[] {
  const parents = comments.filter((c) => !c.parent_id);
  return [...parents].sort((a, b) => {
    const delta =
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return sortOrder === 'newest' ? -delta : delta;
  });
}

export function groupRepliesByParent(
  comments: CommentItem[]
): Map<string, CommentItem[]> {
  const map = new Map<string, CommentItem[]>();
  for (const comment of comments) {
    if (!comment.parent_id) {
      continue;
    }
    const list = map.get(comment.parent_id) ?? [];
    list.push(comment);
    map.set(comment.parent_id, list);
  }
  for (const [, list] of map) {
    list.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }
  return map;
}

export function toMentionWorkItems(
  workItems: CommentWorkItemOption[]
): Array<Pick<CommentWorkItemOption, 'id' | 'key' | 'title'>> {
  return workItems.map((w) => ({
    id: w.id,
    key: w.key,
    title: w.title,
  }));
}

type BuildMockCommentInput = {
  content: Json;
  targetWorkItemId: string;
  parentId: string | null;
  activeUserId: string;
  currentUserName: string;
  workItems: CommentWorkItemOption[];
};

export function buildMockComment({
  content,
  targetWorkItemId,
  parentId,
  activeUserId,
  currentUserName,
  workItems,
}: BuildMockCommentInput): CommentItem {
  const selectedItem = workItems.find((w) => w.id === targetWorkItemId);
  return {
    id: `comment-${Date.now()}`,
    work_item_id: targetWorkItemId,
    author_id: activeUserId,
    parent_id: parentId,
    content,
    edited: false,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    author: {
      id: activeUserId,
      name: currentUserName,
      email: 'user@alice.dev',
      role: 'admin',
    },
    work_item: selectedItem
      ? {
          id: selectedItem.id,
          title: selectedItem.title,
          key: selectedItem.key,
          type: selectedItem.type,
          project: {
            id: selectedItem.project_id,
            name: selectedItem.project_name || 'Project',
            key: selectedItem.key.split('-')[0] || 'PROJ',
          },
        }
      : null,
  };
}
