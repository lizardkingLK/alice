import { ChartsDashboardShell } from '@/app/charts/_components/charts-dashboard-shell';
import { ChartsRedirectClient } from '@/app/charts/_components/charts-redirect-client';
import { getDbUser } from '@/lib/auth';
import { redirect } from 'next/navigation';

/** Bare `/charts` → last-opened workspace (or create default). */
export default async function ChartsIndexPage() {
  const dbUser = await getDbUser();
  if (!dbUser) {
    redirect('/login');
  }

  return (
    <ChartsDashboardShell>
      <ChartsRedirectClient userId={dbUser.id} />
    </ChartsDashboardShell>
  );
}
