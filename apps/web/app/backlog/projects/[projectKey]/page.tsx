import { Suspense } from 'react';
import { Metadata } from 'next';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { BacklogData } from '@/app/backlog/_components/backlog-data';
import { BacklogPageSkeleton } from '@/app/backlog/_components/backlog-page-skeleton';
import { resolveGlobalFilterPath } from '@/app/board/_helpers/resolve-global-filter-path';
import { globalBacklogHref } from '@/app/projects/_helpers/project-tree-links';
import type { RawSearchParams } from '@/lib/search-params';

export const metadata: Metadata = {
  title: 'Backlog',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function BacklogProjectFilterPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ projectKey: string }>;
  searchParams: Promise<RawSearchParams>;
}>) {
  const { projectKey: rawProjectKey } = await params;
  const resolvedSearchParams = await searchParams;
  const { projectId, projectKey } = await resolveGlobalFilterPath({
    area: 'backlog',
    rawProjectKey,
    searchParams: resolvedSearchParams,
  });

  return (
    <DashboardShell
      description="Plan sprints, prioritize tasks, and manage your product backlog."
      breadcrumbOverrides={[
        { label: 'Dashboard', url: '/dashboard' },
        { label: 'Backlog', url: '/backlog' },
        {
          label: projectKey,
          url: globalBacklogHref({ projectKey }),
        },
      ]}
    >
      <Suspense fallback={<BacklogPageSkeleton />}>
        <BacklogData lockedProjectId={projectId} />
      </Suspense>
    </DashboardShell>
  );
}
