import { getAllowedChildType, type WorkItemType } from '@repo/types';
import { redirect } from 'next/navigation';
import WorkItemDetails from '@/app/work-items/_components/work-item-details/work-item-details';
import {
  getWorkItem,
  getWorkItemAncestors,
  getWorkItems,
} from '@/app/work-items/_services/work-items.reads.server';
import { getWorkItemAttachments } from '@/app/attachments/_services/attachments.reads.supabase.server';
import {
  getCommentCountsByWorkItemIds,
  getWorkItemDiscussion,
} from '@/app/comments/_services/comments.reads.server';
import {
  getProject,
  getProjectMembers,
} from '@/app/projects/_services/projects.reads.server';
import { getWorkItemWorkLogs } from '@/app/worklogs/_services/worklogs.reads.supabase.server';
import { getDbUser } from '@/lib/auth';
import { zeroCountsById } from '@/lib/db/query';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import type { WorkItemPatchMemberOption } from '@/app/work-items/_components/work-item-details/work-item-field-patch-dialog';

type WorkItemDetailsDataProps = {
  readonly workItemId: string;
};

export async function WorkItemDetailsData({
  workItemId,
}: Readonly<WorkItemDetailsDataProps>) {
  const [workItem, initialComments, initialAttachments, dbUser] =
    await Promise.all([
      getWorkItem(workItemId),
      getWorkItemDiscussion(workItemId),
      getWorkItemAttachments(workItemId),
      getDbUser(),
    ]);

  if (!workItem) {
    redirect('/dashboard');
  }

  const allowedChildType = getAllowedChildType(workItem.type as WorkItemType);
  const childRecordStatus =
    workItem.record_status === 'archived' ? 'archived' : 'active';

  const [initialWorkLogs, childWorkItems, project, ancestors, linkableRaw] =
    await Promise.all([
      safeServerFetch(
        getWorkItemWorkLogs(workItemId),
        [],
        'fetch work logs for work item details'
      ),
      safeServerFetch(
        getWorkItems({
          parentId: workItemId,
          recordStatus: childRecordStatus,
        }),
        [],
        'fetch subtasks for work item details'
      ),
      workItem.project_id
        ? safeServerFetch(
            getProject(workItem.project_id),
            null,
            'fetch project for work item details'
          )
        : Promise.resolve(null),
      safeServerFetch(
        getWorkItemAncestors(workItem.parent_id),
        [],
        'fetch ancestors for work item details'
      ),
      allowedChildType && workItem.project_id
        ? safeServerFetch(
            getWorkItems({
              projectId: workItem.project_id,
              type: allowedChildType,
              parentId: null,
              recordStatus: 'active',
            }),
            [],
            'fetch linkable subtask candidates'
          )
        : Promise.resolve([]),
    ]);

  const childIds = new Set(childWorkItems.map((child) => child.id));
  const linkableWorkItems = linkableRaw.filter(
    (item) => item.id !== workItemId && !childIds.has(item.id)
  );

  const [projectMembers, childCommentCounts] = await Promise.all([
    workItem.project_id
      ? safeServerFetch(
          getProjectMembers(workItem.project_id),
          [],
          'fetch project members for work item details'
        )
      : Promise.resolve([]),
    safeServerFetch(
      getCommentCountsByWorkItemIds(childWorkItems.map((child) => child.id)),
      zeroCountsById(childWorkItems.map((child) => child.id)),
      'fetch subtask comment counts for work item details'
    ),
  ]);

  const memberOptions: WorkItemPatchMemberOption[] = projectMembers
    .map((member) => member.user)
    .filter((user): user is NonNullable<typeof user> => Boolean(user))
    .map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      profile_picture: user.profile_picture ?? null,
    }));

  const currentUserId = dbUser?.id ?? 'user-admin-1';

  return (
    <WorkItemDetails
      workItemDetails={workItem}
      childWorkItems={childWorkItems}
      childCommentCounts={childCommentCounts}
      linkableWorkItems={linkableWorkItems}
      ancestors={ancestors}
      project={project}
      initialComments={initialComments}
      initialAttachments={initialAttachments}
      initialWorkLogs={initialWorkLogs}
      currentUserId={currentUserId}
      projectMembers={memberOptions}
    />
  );
}
