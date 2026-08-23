import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { SettingsData } from '@/app/settings/_components/settings-data';
import type { RawSearchParams } from '@/lib/search-params';

export default function SettingsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<RawSearchParams>;
}>) {
  return (
    <DashboardShell sidebarDefaultOpen={false} contentClassName="p-0">
      <SettingsData searchParams={searchParams} />
    </DashboardShell>
  );
}
