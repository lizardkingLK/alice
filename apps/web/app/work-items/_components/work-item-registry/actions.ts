'use server';

import {
  getWorkItem,
  getWorkItems,
  type DbWorkItem,
} from '@/app/work-items/_services/work-items.reads.server';
import { getDbUser } from '@/lib/auth';
import { canAccessProjectWorkspace } from '@/lib/projects/project-workspace-access';

/** Cap ancestor walks (Epic → Story → Task(+)). */
const MAX_HIERARCHY_AUTH_DEPTH = 8;

export type LoadWorkItemChildrenResult =
  | { readonly ok: true; readonly children: DbWorkItem[] }
  | { readonly ok: false; readonly error: string };

/**
 * Hierarchy expand auth for My Work and registry.
 * - Project-scoped parents: workspace ACL only (owner / active member / admin).
 * - Non-project parents: assignee, reporter, or ancestor assignee/reporter.
 */
async function canLoadWorkItemChildren(
  userId: string,
  _role: string,
  parent: DbWorkItem
): Promise<boolean> {
  // Project-scoped items: workspace ACL is terminal. Do not fall back to
  // assignee/reporter — a removed member who remains assignee must not load
  // project children.
  if (parent.project_id) {
    return canAccessProjectWorkspace(userId, parent.project_id);
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

/**
 * Load direct children for hierarchy expand. Returns a result object instead of
 * throwing so production clients receive a usable message (Next omits thrown
 * Error messages in prod).
 */
export async function loadWorkItemChildrenAction(
  parentId: unknown
): Promise<LoadWorkItemChildrenResult> {
  if (typeof parentId !== 'string' || !parentId.trim()) {
    return { ok: true, children: [] };
  }

  try {
    const currentUser = await getDbUser();
    if (!currentUser) {
      return { ok: false, error: 'Not authenticated.' };
    }

    const parent = await getWorkItem(parentId.trim());
    if (!parent?.id) {
      return { ok: true, children: [] };
    }

    const allowed = await canLoadWorkItemChildren(
      currentUser.id,
      currentUser.role,
      parent
    );
    if (!allowed) {
      return {
        ok: false,
        error: parent.project_id
          ? "You're not a member of this project."
          : 'Not authorized to view this work item.',
      };
    }

    const recordStatus =
      parent.record_status === 'archived' ? 'archived' : 'active';
    const children = await getWorkItems({
      parentId: parent.id,
      recordStatus,
    });
    return { ok: true, children };
  } catch (loadError) {
    console.error('error. failed to load work item children', loadError);
    return {
      ok: false,
      error:
        loadError instanceof Error
          ? loadError.message
          : 'Failed to load subtasks.',
    };
  }
}
