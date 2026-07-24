import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { BoardPageSkeleton } from '@/app/board/_components/board-page-skeleton';

const BOARD_BREADCRUMBS = [
  { label: 'Dashboard', url: '/dashboard' },
  { label: 'Board', url: '/board' },
] as const;

export default function BoardLoading() {
  return (
    <DashboardShell
      description="Track progress, update task statuses, and organize work-items in real-time."
      breadcrumbOverrides={[...BOARD_BREADCRUMBS]}
    >
      <BoardPageSkeleton />
    </DashboardShell>
  );
}
