import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { WorkItemsData } from '@/app/work-items/_components/work-items-data';
import { RegistryPageSkeleton } from '@/components/registry-page-skeleton';
import { getDbUser } from '@/lib/auth';
import type { RawSearchParams } from '@/lib/search-params';
import {
  MEMBER_BREADCRUMBS,
  MEMBER_PAGE_DESCRIPTION,
  MEMBER_PAGE_SKELETON,
} from '@/app/member/_components/member-page-meta';

export default async function MemberDashboard({
  searchParams,
}: Readonly<{
  searchParams: Promise<RawSearchParams>;
}>) {
  const dbUser = await getDbUser();
  if (!dbUser) {
    redirect('/login');
  }

  return (
    <DashboardShell
      description={MEMBER_PAGE_DESCRIPTION}
      breadcrumbOverrides={MEMBER_BREADCRUMBS}
    >
      <Suspense fallback={<RegistryPageSkeleton {...MEMBER_PAGE_SKELETON} />}>
        <WorkItemsData
          searchParams={searchParams}
          lockedAssigneeId={dbUser.id}
          currentUserId={dbUser.id}
        />
      </Suspense>
    </DashboardShell>
  );
}
