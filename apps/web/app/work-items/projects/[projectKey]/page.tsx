import { Suspense } from 'react';
import { Metadata } from 'next';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { WorkItemsData } from '@/app/work-items/_components/work-items-data';
import { RegistryPageSkeleton } from '@/components/registry-page-skeleton';
import { resolveGlobalFilterPath } from '@/app/board/_helpers/resolve-global-filter-path';
import { globalWorkItemsHref } from '@/app/projects/_helpers/project-tree-links';
import { REGISTRY_PAGES } from '@/components/registry-page-shell';
import type { RawSearchParams } from '@/lib/search-params';

export const metadata: Metadata = {
  title: 'Work Items',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function WorkItemsProjectFilterPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ projectKey: string }>;
  searchParams: Promise<RawSearchParams>;
}>) {
  const { projectKey: rawProjectKey } = await params;
  const resolvedSearchParams = await searchParams;
  const { projectKey, injectedSearchParams } = await resolveGlobalFilterPath({
    area: 'work-items',
    rawProjectKey,
    searchParams: resolvedSearchParams,
  });

  return (
    <DashboardShell
      description={REGISTRY_PAGES.workItems.description}
      breadcrumbOverrides={[
        { label: 'Dashboard', url: '/dashboard' },
        { label: 'Work Items', url: '/work-items' },
        {
          label: projectKey,
          url: globalWorkItemsHref({ projectKey }),
        },
      ]}
    >
      <Suspense
        fallback={
          <RegistryPageSkeleton {...REGISTRY_PAGES.workItems.skeleton} />
        }
      >
        <WorkItemsData searchParams={Promise.resolve(injectedSearchParams)} />
      </Suspense>
    </DashboardShell>
  );
}
