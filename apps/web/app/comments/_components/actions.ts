'use server';

import type { Json } from '@repo/types';
import { revalidatePath } from 'next/cache';
import { getDbUser } from '@/lib/auth';
import { unexpectedActionError } from '@/lib/server-actions';
import {
  createComment as apiCreateComment,
  updateComment as apiUpdateComment,
  archiveComment as apiArchiveComment,
  restoreComment as apiRestoreComment,
} from '../_services/comments.reads.server';
import type { CommentItem } from '../_services/comments.mutations.shared';

type CommentActionFailure = { success: false; error: string };
type CommentDbUser = NonNullable<Awaited<ReturnType<typeof getDbUser>>>;

async function runAuthenticatedCommentAction<T extends { success: boolean }>(
  // eslint-disable-next-line no-unused-vars -- callback signature
  action: (user: CommentDbUser) => Promise<T>
): Promise<T | CommentActionFailure> {
  const currentUser = await getDbUser();
  if (!currentUser) {
    return { success: false, error: 'Not authenticated.' };
  }

  try {
    return await action(currentUser);
  } catch (err) {
    const { error } = unexpectedActionError(err);
    return {
      success: false,
      error: error ?? 'An unexpected error occurred.',
    };
  }
}

export async function createCommentAction(input: {
  work_item_id: string;
  content: Json;
  parent_id?: string | null;
}): Promise<{ success: boolean; data?: CommentItem; error?: string }> {
  return runAuthenticatedCommentAction(async (currentUser) => {
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
  });
}

export async function updateCommentAction(
  commentId: string,
  content: Json,
  expectedUpdatedAt: string
): Promise<{ success: boolean; data?: CommentItem; error?: string }> {
  return runAuthenticatedCommentAction(async () => {
    const updated = await apiUpdateComment(
      commentId,
      content,
      expectedUpdatedAt
    );

    revalidatePath('/comments');
    return { success: true, data: updated };
  });
}

export async function archiveCommentAction(
  commentId: string,
  expectedUpdatedAt: string,
  permanent?: boolean
): Promise<{ success: boolean; error?: string }> {
  return runAuthenticatedCommentAction(async () => {
    await apiArchiveComment(commentId, expectedUpdatedAt, permanent);

    revalidatePath('/comments');
    return { success: true };
  });
}

export async function restoreCommentAction(
  commentId: string,
  expectedUpdatedAt: string
): Promise<{ success: boolean; error?: string }> {
  return runAuthenticatedCommentAction(async () => {
    await apiRestoreComment(commentId, expectedUpdatedAt);

    revalidatePath('/comments');
    return { success: true };
  });
}
