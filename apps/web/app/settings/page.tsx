import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { SettingsData } from '@/app/settings/_components/settings-data';
import { SETTINGS_BREADCRUMBS } from '@/app/settings/_components/settings-page-meta';
import type { RawSearchParams } from '@/lib/search-params';

export default function SettingsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<RawSearchParams>;
}>) {
  return (
    <DashboardShell
      sidebarDefaultOpen={false}
      contentClassName="p-0"
      breadcrumbOverrides={SETTINGS_BREADCRUMBS}
      breadcrumbAsTrail
    >
      <SettingsData searchParams={searchParams} />
    </DashboardShell>
  );
}
