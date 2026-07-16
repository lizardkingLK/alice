import { Metadata } from 'next';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { KanbanBoard } from './_components/kanban-board';

export const metadata: Metadata = {
  title: 'Board',
  robots: {
    index: false,
    follow: false,
  },
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
