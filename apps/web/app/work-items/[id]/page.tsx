import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import WorkItemDetails from '@/app/work-items/_components/workItem-details';
import { getWorkItem } from '@/app/work-items/_services/workItem.server.service';

export default async function WorkItemPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const workItem = await getWorkItem(id);
  const shortId = workItem.id.slice(0, 8).toUpperCase();

  return (
    <DashboardShell
      description="Work-Item Details"
      breadcrumbOverrides={[
        { label: 'Dashboard', url: '/dashboard' },
        { label: 'Work Items', url: '/work-items' },
        { label: shortId, url: `/work-items/${workItem.id}` },
      ]}
    >
      <WorkItemDetails workItemDetails={workItem} />
    </DashboardShell>
  );
}
