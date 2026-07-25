import { Suspense } from 'react';
import { Metadata } from 'next';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { BoardData } from '@/app/board/_components/board-data';
import { BoardPageSkeleton } from '@/app/board/_components/board-page-skeleton';
import type { RawSearchParams } from '@/lib/search-params';

export const metadata: Metadata = {
  title: 'Board',
  robots: {
    index: false,
    follow: false,
  },
};

const BOARD_BREADCRUMBS = [
  { label: 'Dashboard', url: '/dashboard' },
  { label: 'Board', url: '/board' },
] as const;

export default function BoardPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<RawSearchParams>;
}>) {
  return (
    <DashboardShell
      description="Track progress, update task statuses, and organize work-items in real-time."
      breadcrumbOverrides={[...BOARD_BREADCRUMBS]}
    >
      <Suspense fallback={<BoardPageSkeleton />}>
        <BoardData searchParams={searchParams} />
      </Suspense>
    </DashboardShell>
  );
}
