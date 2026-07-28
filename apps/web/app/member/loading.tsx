import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { RegistryPageSkeleton } from '@/components/registry-page-skeleton';
import {
  MEMBER_BREADCRUMBS,
  MEMBER_PAGE_DESCRIPTION,
  MEMBER_PAGE_SKELETON,
} from '@/app/member/_components/member-page-meta';

export default function MemberLoading() {
  return (
    <DashboardShell
      description={MEMBER_PAGE_DESCRIPTION}
      breadcrumbOverrides={MEMBER_BREADCRUMBS}
    >
      <RegistryPageSkeleton {...MEMBER_PAGE_SKELETON} />
    </DashboardShell>
  );
}
