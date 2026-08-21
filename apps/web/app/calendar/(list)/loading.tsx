import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { REGISTRY_PAGES } from '@/components/registry-page-shell';
import { RegistryPageSkeleton } from '@/components/registry-page-skeleton';

export default function CalendarLoading() {
  return (
    <DashboardShell
      description={REGISTRY_PAGES.calendar.description}
      contentScrollable={false}
    >
      <RegistryPageSkeleton {...REGISTRY_PAGES.calendar.skeleton} />
    </DashboardShell>
  );
}
