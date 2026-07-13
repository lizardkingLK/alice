import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import WorkItemDetails from '@/app/work-items/_components/workItem-details';

export default async function WorkItemPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id: workItemId } = await params;

  return (
    <DashboardShell description="Work-Item Details">
      <WorkItemDetails workItemId={workItemId} />
    </DashboardShell>
  );
}
