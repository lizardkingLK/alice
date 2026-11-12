import { Suspense } from 'react';
import { Metadata } from 'next';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { BoardData } from '@/app/board/_components/board-data';
import { BoardPageSkeleton } from '@/app/board/_components/board-page-skeleton';
import { resolveGlobalFilterPath } from '@/app/board/_helpers/resolve-global-filter-path';
import { globalBoardHref } from '@/app/projects/_helpers/project-tree-links';
import type { RawSearchParams } from '@/lib/search-params';

export const metadata: Metadata = {
  title: 'Board',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function BoardProjectSprintFilterPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ projectKey: string; sprintSlug: string }>;
  searchParams: Promise<RawSearchParams>;
}>) {
  const { projectKey: rawProjectKey, sprintSlug: rawSprintSlug } = await params;
  const resolvedSearchParams = await searchParams;
  const { projectKey, sprintSlug, injectedSearchParams } =
    await resolveGlobalFilterPath({
      area: 'board',
      rawProjectKey,
      rawSprintSlug,
      searchParams: resolvedSearchParams,
    });

  return (
    <DashboardShell
      description="Track progress, update task statuses, and organize work-items in real-time."
      breadcrumbOverrides={[
        { label: 'Dashboard', url: '/dashboard' },
        { label: 'Board', url: '/board' },
        {
          label: projectKey,
          url: globalBoardHref({ projectKey }),
        },
        {
          label: sprintSlug ?? 'Sprint',
          url: globalBoardHref({ projectKey, sprintSlug }),
        },
      ]}
      contentScrollable={false}
    >
      <Suspense fallback={<BoardPageSkeleton />}>
        <BoardData searchParams={Promise.resolve(injectedSearchParams)} />
      </Suspense>
    </DashboardShell>
  );
}
