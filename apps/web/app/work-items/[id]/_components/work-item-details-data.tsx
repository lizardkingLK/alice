import WorkItemDetails from '@/app/work-items/_components/workItem-details';
import { getWorkItem } from '@/app/work-items/_services/workItem.service.server';
import { getWorkItemDiscussion } from '@/app/comments/_services/comments.service.server';
import { getProjectMembers } from '@/app/projects/_services/projects.service.server';
import { getDbUser } from '@/lib/auth';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import type { WorkItemPatchMemberOption } from '@/app/work-items/_components/workItem-field-patch-dialog';

type WorkItemDetailsDataProps = {
  readonly workItemId: string;
};

export async function WorkItemDetailsData({
  workItemId,
}: Readonly<WorkItemDetailsDataProps>) {
  const [workItem, initialComments, dbUser] = await Promise.all([
    getWorkItem(workItemId),
    getWorkItemDiscussion(workItemId),
    getDbUser(),
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
      initialComments={initialComments}
      currentUserId={currentUserId}
      projectMembers={memberOptions}
    />
  );
}
