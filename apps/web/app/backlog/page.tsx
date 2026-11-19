import { Suspense } from 'react';
import { Metadata } from 'next';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { BacklogData } from '@/app/backlog/_components/backlog-data';
import { BacklogPageSkeleton } from '@/app/backlog/_components/backlog-page-skeleton';
import { redirectLegacyGlobalFilterQuery } from '@/app/board/_helpers/redirect-legacy-filter-query';
import type { RawSearchParams } from '@/lib/search-params';

export const metadata: Metadata = {
  title: 'Backlog',
  robots: {
    index: false,
    follow: false,
  },
};

const BACKLOG_BREADCRUMBS = [
  { label: 'Dashboard', url: '/dashboard' },
  { label: 'Backlog', url: '/backlog' },
] as const;

export default async function BacklogPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<RawSearchParams>;
}>) {
  const resolvedSearchParams = await searchParams;
  await redirectLegacyGlobalFilterQuery({
    area: 'backlog',
    searchParams: resolvedSearchParams,
  });

  return (
    <DashboardShell
      description="Plan sprints, prioritize tasks, and manage your product backlog."
      breadcrumbOverrides={[...BACKLOG_BREADCRUMBS]}
    >
      <Suspense fallback={<BacklogPageSkeleton />}>
        <BacklogData />
      </Suspense>
    </DashboardShell>
  );
}
