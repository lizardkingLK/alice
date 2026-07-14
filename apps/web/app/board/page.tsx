import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { KanbanBoard } from './_components/kanban-board';

export const metadata = {
  title: 'Kanban Board - Jira Teams',
  description: 'Manage and track project tasks on the Kanban board.',
};

export default async function BoardPage() {
  return (
    <DashboardShell
      description="Track progress, update task statuses, and organize work-items in real-time."
      breadcrumbOverrides={[
        { label: 'Dashboard', url: '/dashboard' },
        { label: 'Board', url: '/board' },
      ]}
    >
      <KanbanBoard />
    </DashboardShell>
  );
}
