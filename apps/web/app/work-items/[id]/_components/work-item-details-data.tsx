import WorkItemDetails from '@/app/work-items/_components/workItem-details';
import { getWorkItem } from '@/app/work-items/_services/workItem.service.server';
import { getWorkItemDiscussion } from '@/app/comments/_services/comments.service.server';

type WorkItemDetailsDataProps = {
  readonly workItemId: string;
};

export async function WorkItemDetailsData({
  workItemId,
}: Readonly<WorkItemDetailsDataProps>) {
  const [workItem, initialComments] = await Promise.all([
    getWorkItem(workItemId),
    getWorkItemDiscussion(workItemId),
  ]);

  return (
    <WorkItemDetails
      workItemDetails={workItem}
      initialComments={initialComments}
    />
  );
}
