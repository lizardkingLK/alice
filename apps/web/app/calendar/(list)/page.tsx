import { Suspense } from 'react';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { CalendarData } from '@/app/calendar/_components/calendar-data';
import { REGISTRY_PAGES } from '@/components/registry-page-shell';
import { RegistryPageSkeleton } from '@/components/registry-page-skeleton';

const CALENDAR_BREADCRUMBS = [
  { label: 'Dashboard', url: '/dashboard' },
  { label: 'Calendar', url: '/calendar' },
] as const;

export default function CalendarPage() {
  return (
    <DashboardShell
      description={REGISTRY_PAGES.calendar.description}
      breadcrumbOverrides={[...CALENDAR_BREADCRUMBS]}
      contentScrollable={false}
    >
      <Suspense
        fallback={
          <RegistryPageSkeleton {...REGISTRY_PAGES.calendar.skeleton} />
        }
      >
        <CalendarData />
      </Suspense>
    </DashboardShell>
  );
}
