import { getAllowedChildType, type WorkItemType } from '@repo/types';
import { redirect } from 'next/navigation';
import WorkItemDetails from '@/app/work-items/_components/work-item-details/work-item-details';
import {
  getWorkItem,
  getWorkItemAncestors,
  getWorkItems,
} from '@/app/work-items/_services/work-items.reads.server';
import { getWorkItemAttachments } from '@/app/attachments/_services/attachments.reads.server';
import {
  getCommentCountsByWorkItemIds,
  getWorkItemDiscussion,
  listCommentWorkItemOptions,
} from '@/app/comments/_services/comments.reads.server';
import { getWorkItemActivities } from '@/app/work-items/_services/activities.reads.supabase.server';
import {
  getProject,
  getProjectMembers,
} from '@/app/projects/_services/projects.reads.server';
import { EMPTY_ACTIVE_SPRINTS_PAGE } from '@/app/board/_services/board.reads.defaults.server';
import { getSprintsPaginatedServer } from '@/app/sprints/_services/sprints.reads.server';
import { getWorkItemWorkLogs } from '@/app/worklogs/_services/worklogs.reads.server';
import { getDbUser } from '@/lib/auth';
import { zeroCountsById } from '@/lib/db/query';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import type { WorkItemPatchMemberOption } from '@/app/work-items/_components/work-item-details/work-item-field-patch-dialog';
import { readWorkItemDetailsPreferencesBootstrap } from '@/app/work-items/_helpers/work-item-details-preferences-cookie.server';
import type { WorkItemSprintOption } from '@/app/work-items/_helpers/work-item-sprint';

type WorkItemDetailsDataProps = {
  readonly workItemId: string;
};

export async function WorkItemDetailsData({
  workItemId,
}: Readonly<WorkItemDetailsDataProps>) {
  const [
    workItem,
    initialComments,
    initialAttachments,
    initialActivities,
    dbUser,
    detailsPreferencesBootstrap,
  ] = await Promise.all([
    getWorkItem(workItemId),
    getWorkItemDiscussion(workItemId),
    getWorkItemAttachments(workItemId),
    getWorkItemActivities(workItemId),
    getDbUser(),
    readWorkItemDetailsPreferencesBootstrap(),
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

  const [
    projectMembers,
    projectSprintsResult,
    childCommentCounts,
    discussionWorkItems,
  ] = await Promise.all([
    workItem.project_id
      ? safeServerFetch(
          getProjectMembers(workItem.project_id),
          [],
          'fetch project members for work item details'
        )
      : Promise.resolve([]),
    workItem.project_id
      ? safeServerFetch(
          getSprintsPaginatedServer('active', 1, 100, undefined, {
            projectId: workItem.project_id,
          }),
          EMPTY_ACTIVE_SPRINTS_PAGE,
          'fetch project sprints for work item details'
        )
      : Promise.resolve(EMPTY_ACTIVE_SPRINTS_PAGE),
    safeServerFetch(
      getCommentCountsByWorkItemIds(childWorkItems.map((child) => child.id)),
      zeroCountsById(childWorkItems.map((child) => child.id)),
      'fetch subtask comment counts for work item details'
    ),
    workItem.project_id
      ? safeServerFetch(
          listCommentWorkItemOptions(100, {
            projectId: workItem.project_id,
          }),
          [],
          'fetch project work items for discussion mentions'
        )
      : Promise.resolve([]),
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

  const sprintOptions: WorkItemSprintOption[] =
    projectSprintsResult.sprints.map((sprint) => ({
      id: sprint.id,
      name: sprint.name,
      status: sprint.status,
    }));

  const currentUserId = dbUser?.id ?? 'user-admin-1';
  const currentUserRole = dbUser?.role;

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
      initialActivities={initialActivities}
      initialWorkLogs={initialWorkLogs}
      currentUserId={currentUserId}
      currentUserRole={currentUserRole}
      projectMembers={memberOptions}
      projectSprints={sprintOptions}
      discussionWorkItems={discussionWorkItems}
      initialDetailsPreferences={detailsPreferencesBootstrap.preferences}
    />
  );
}
