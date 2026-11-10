import { Suspense } from 'react';
import { Metadata } from 'next';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { BoardData } from '@/app/board/_components/board-data';
import { BoardPageSkeleton } from '@/app/board/_components/board-page-skeleton';
import { redirectLegacyGlobalFilterQuery } from '@/app/board/_helpers/redirect-legacy-filter-query';
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

export default async function BoardPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<RawSearchParams>;
}>) {
  const resolvedSearchParams = await searchParams;
  await redirectLegacyGlobalFilterQuery({
    area: 'board',
    searchParams: resolvedSearchParams,
  });

  return (
    <DashboardShell
      description="Track progress, update task statuses, and organize work-items in real-time."
      breadcrumbOverrides={[...BOARD_BREADCRUMBS]}
      contentScrollable={false}
    >
      <Suspense fallback={<BoardPageSkeleton />}>
        <BoardData searchParams={Promise.resolve(resolvedSearchParams)} />
      </Suspense>
    </DashboardShell>
  );
}
