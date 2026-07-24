import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import WorkItemDetails from '@/app/work-items/_components/workItem-details';
import { getWorkItem } from '@/app/work-items/_services/workItem.service.server';
import { getWorkItemDiscussion } from '@/app/comments/_services/comments.service.server';
import { getDbUser } from '@/lib/auth';

export default async function WorkItemPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;

  const [workItem, initialComments] = await Promise.all([
    getWorkItem(id),
    getWorkItemDiscussion(id),
  ]);

  const shortId = workItem.id.slice(0, 8).toUpperCase();

  const dbUser = await getDbUser();
  const currentUserId = dbUser?.id ?? 'user-admin-1';

  return (
    <DashboardShell
      description="Work-Item Details"
      breadcrumbOverrides={[
        { label: 'Dashboard', url: '/dashboard' },
        { label: 'Work Items', url: '/work-items' },
        { label: shortId, url: `/work-items/${workItem.id}` },
      ]}
    >
      <WorkItemDetails
        workItemDetails={workItem}
        initialComments={initialComments}
        currentUserId={currentUserId}
      />
    </DashboardShell>
  );
}
