'use server';

import { getActiveMemberProjectIds } from '@/app/board/_services/board-defaults.server';
import {
  getWorkItem,
  getWorkItems,
  type DbWorkItem,
} from '@/app/work-items/_services/workItem.service.server';
import { getDbUser } from '@/lib/auth';

/** Cap ancestor walks (Epic → Story → Task(+)). */
const MAX_HIERARCHY_AUTH_DEPTH = 8;

/**
 * Hierarchy expand must work on My Work (/member): roots are assignee-scoped,
 * but children of any assignee should load when the viewer can see the parent
 * chain. Project membership alone is too strict for that.
 */
async function canLoadWorkItemChildren(
  userId: string,
  isAdmin: boolean,
  parent: DbWorkItem
): Promise<boolean> {
  if (isAdmin) {
    return true;
  }

  if (parent.project_id) {
    const memberProjectIds = await getActiveMemberProjectIds(userId);
    if (memberProjectIds.includes(parent.project_id)) {
      return true;
    }
  }

  if (parent.assignee_id === userId || parent.reporter_id === userId) {
    return true;
  }

  let ancestorId = parent.parent_id;
  const seen = new Set<string>([parent.id]);

  for (let depth = 0; depth < MAX_HIERARCHY_AUTH_DEPTH && ancestorId; depth++) {
    if (seen.has(ancestorId)) {
      break;
    }
    seen.add(ancestorId);

    const ancestor = await getWorkItem(ancestorId);
    if (!ancestor?.id) {
      break;
    }

    if (ancestor.assignee_id === userId || ancestor.reporter_id === userId) {
      return true;
    }

    ancestorId = ancestor.parent_id;
  }

  return false;
}

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
  if (!parent?.id) {
    return [];
  }

  const allowed = await canLoadWorkItemChildren(
    currentUser.id,
    currentUser.role === 'admin',
    parent
  );
  if (!allowed) {
    throw new Error('Not authorized to view this work item.');
  }

  return getWorkItems({ parentId: parent.id });
}
