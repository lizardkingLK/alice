import WorkItemDetails from '@/app/work-items/_components/workItem-details';
import {
  getWorkItem,
  getWorkItems,
} from '@/app/work-items/_services/workItem.service.server';
import { getWorkItemAttachments } from '@/app/work-items/_services/attachments.service.server';
import { getWorkItemDiscussion } from '@/app/comments/_services/comments.service.server';
import {
  getProject,
  getProjectMembers,
} from '@/app/projects/_services/projects.service.server';
import { getWorkItemWorkLogs } from '@/app/work-items/_services/workItem-worklogs.service.server';
import { getDbUser } from '@/lib/auth';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import type { WorkItemPatchMemberOption } from '@/app/work-items/_components/workItem-field-patch-dialog';

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

  const [initialWorkLogs, childWorkItems, project] = await Promise.all([
    safeServerFetch(
      getWorkItemWorkLogs(workItemId),
      [],
      'fetch work logs for work item details'
    ),
    safeServerFetch(
      getWorkItems({ parentId: workItemId }),
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
  ]);

  const projectMembers = workItem.project_id
    ? await safeServerFetch(
        getProjectMembers(workItem.project_id),
        [],
        'fetch project members for work item details'
      )
    : [];

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
      project={project}
      initialComments={initialComments}
      initialAttachments={initialAttachments}
      initialWorkLogs={initialWorkLogs}
      currentUserId={currentUserId}
      projectMembers={memberOptions}
    />
  );
}
