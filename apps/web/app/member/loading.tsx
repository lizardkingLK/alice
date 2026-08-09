import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { getWorkItemsRegistrySkeletonProps } from '@/app/work-items/_helpers/work-item-registry-skeleton.server';
import { RegistryPageSkeleton } from '@/components/registry-page-skeleton';
import {
  MEMBER_BREADCRUMBS,
  MEMBER_PAGE_DESCRIPTION,
} from '@/app/member/_components/member-page-meta';

export default async function MemberLoading() {
  const skeleton = await getWorkItemsRegistrySkeletonProps();

  return (
    <DashboardShell
      description={MEMBER_PAGE_DESCRIPTION}
      breadcrumbOverrides={MEMBER_BREADCRUMBS}
    >
      <RegistryPageSkeleton {...skeleton} />
    </DashboardShell>
  );
}
