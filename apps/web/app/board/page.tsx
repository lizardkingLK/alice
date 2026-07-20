import { Metadata } from 'next';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { getWorkItems } from '@/app/work-items/_services/workItem.server.service';
import { KanbanBoard } from './_components/kanban-board';

export const metadata: Metadata = {
  title: 'Board',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function BoardPage() {
  const workItems = await getWorkItems();
  const boardItems = workItems.filter((item) => item.status !== 'Draft');

  return (
    <DashboardShell
      description="Track progress, update task statuses, and organize work-items in real-time."
      breadcrumbOverrides={[
        { label: 'Dashboard', url: '/dashboard' },
        { label: 'Board', url: '/board' },
      ]}
    >
      <KanbanBoard initialWorkItems={boardItems} />
    </DashboardShell>
  );
}
