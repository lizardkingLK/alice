'use server';

import { revalidatePath } from 'next/cache';
import { getDbUser } from '@/lib/auth';
import {
  createComment as apiCreateComment,
  updateComment as apiUpdateComment,
  archiveComment as apiArchiveComment,
  restoreComment as apiRestoreComment,
} from '../_services/comments.service.server';
import type { CommentItem } from '../_services/comments.service.base';

export type ActionState = {
  success: boolean;
  error: string | null;
};

export async function createCommentAction(input: {
  work_item_id: string;
  content: string;
  parent_id?: string | null;
}): Promise<{ success: boolean; data?: CommentItem; error?: string }> {
  const currentUser = await getDbUser();
  if (!currentUser) {
    return { success: false, error: 'Not authenticated.' };
  }

  try {
    const created = await apiCreateComment({
      work_item_id: input.work_item_id,
      content: input.content,
      parent_id: input.parent_id ?? null,
      author_id: currentUser.id,
    });

    revalidatePath('/comments');
    if (input.work_item_id) {
      revalidatePath(`/work-items/${input.work_item_id}`);
    }
    return { success: true, data: created };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred.';
    return { success: false, error: message };
  }
}

export async function updateCommentAction(
  commentId: string,
  content: string
): Promise<{ success: boolean; data?: CommentItem; error?: string }> {
  const currentUser = await getDbUser();
  if (!currentUser) {
    return { success: false, error: 'Not authenticated.' };
  }

  try {
    const updated = await apiUpdateComment(commentId, content);

    revalidatePath('/comments');
    return { success: true, data: updated };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred.';
    return { success: false, error: message };
  }
}

export async function archiveCommentAction(
  commentId: string,
  permanent?: boolean
): Promise<{ success: boolean; error?: string }> {
  const currentUser = await getDbUser();
  if (!currentUser) {
    return { success: false, error: 'Not authenticated.' };
  }

  try {
    await apiArchiveComment(commentId, permanent);

    revalidatePath('/comments');
    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred.';
    return { success: false, error: message };
  }
}

export async function restoreCommentAction(
  commentId: string
): Promise<{ success: boolean; error?: string }> {
  const currentUser = await getDbUser();
  if (!currentUser) {
    return { success: false, error: 'Not authenticated.' };
  }

  try {
    await apiRestoreComment(commentId);

    revalidatePath('/comments');
    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred.';
    return { success: false, error: message };
  }
}
