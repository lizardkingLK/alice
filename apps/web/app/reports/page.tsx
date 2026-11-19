import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { ReportsData } from '@/app/reports/_components/reports-data';
import { ReportsPageSkeleton } from '@/app/reports/_components/reports-page-skeleton';
import { getDbUser } from '@/lib/auth';
import { buildLoginPath } from '@/lib/auth-redirect';
import { getRequestPathForLoginNext } from '@/lib/auth-redirect.server';

const DESCRIPTION =
  'Generate a personal daily report from your assigned work items.';

export default async function ReportsPage() {
  const dbUser = await getDbUser();
  if (!dbUser) {
    redirect(buildLoginPath(await getRequestPathForLoginNext()));
  }

  return (
    <DashboardShell description={DESCRIPTION}>
      <Suspense fallback={<ReportsPageSkeleton />}>
        <ReportsData userId={dbUser.id} />
      </Suspense>
    </DashboardShell>
  );
}
