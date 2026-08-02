'use server';

import { getActiveMemberProjectIds } from '@/app/board/_services/board-defaults.server';
import {
  getWorkItem,
  getWorkItems,
  type DbWorkItem,
} from '@/app/work-items/_services/workItem.service.server';
import { getDbUser } from '@/lib/auth';

export async function loadWorkItemChildrenAction(
  parentId: unknown
): Promise<DbWorkItem[]> {
  if (typeof parentId !== 'string' || !parentId.trim()) {
    return [];
  }

  const currentUser = await getDbUser();
  if (!currentUser) {
    throw new Error('Not authenticated.');
  }

  const parent = await getWorkItem(parentId.trim());
  if (!parent?.project_id) {
    return [];
  }

  const isAdmin = currentUser.role === 'admin';
  if (!isAdmin) {
    const memberProjectIds = await getActiveMemberProjectIds(currentUser.id);
    if (!memberProjectIds.includes(parent.project_id)) {
      throw new Error('Not authorized to view this work item.');
    }
  }

  return getWorkItems({ parentId: parent.id });
}
