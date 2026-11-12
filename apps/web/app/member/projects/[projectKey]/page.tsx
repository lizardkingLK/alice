import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { WorkItemsData } from '@/app/work-items/_components/work-items-data';
import { RegistryPageSkeleton } from '@/components/registry-page-skeleton';
import { resolveGlobalFilterPath } from '@/app/board/_helpers/resolve-global-filter-path';
import { globalMemberHref } from '@/app/projects/_helpers/project-tree-links';
import { getDbUser } from '@/lib/auth';
import { buildLoginPath } from '@/lib/auth-redirect';
import { getRequestPathForLoginNext } from '@/lib/auth-redirect.server';
import type { RawSearchParams } from '@/lib/search-params';
import {
  MEMBER_PAGE_DESCRIPTION,
  MEMBER_PAGE_SKELETON,
} from '@/app/member/_components/member-page-meta';

export default async function MemberProjectFilterPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ projectKey: string }>;
  searchParams: Promise<RawSearchParams>;
}>) {
  const dbUser = await getDbUser();
  if (!dbUser) {
    redirect(buildLoginPath(await getRequestPathForLoginNext()));
  }

  const { projectKey: rawProjectKey } = await params;
  const resolvedSearchParams = await searchParams;
  const { projectId, projectKey, injectedSearchParams } =
    await resolveGlobalFilterPath({
      area: 'member',
      rawProjectKey,
      searchParams: resolvedSearchParams,
    });

  return (
    <DashboardShell
      description={MEMBER_PAGE_DESCRIPTION}
      breadcrumbOverrides={[
        { label: 'Dashboard', url: '/dashboard' },
        { label: 'My Work', url: '/member' },
        {
          label: projectKey,
          url: globalMemberHref({ projectKey }),
        },
      ]}
    >
      <Suspense fallback={<RegistryPageSkeleton {...MEMBER_PAGE_SKELETON} />}>
        <WorkItemsData
          searchParams={Promise.resolve(injectedSearchParams)}
          lockedAssigneeId={dbUser.id}
          lockedProjectId={projectId}
          currentUserId={dbUser.id}
        />
      </Suspense>
    </DashboardShell>
  );
}
