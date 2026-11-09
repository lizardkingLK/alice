import { redirect } from 'next/navigation';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { NotificationsPageClient } from '@/app/notifications/_components/notifications-page-client';
import { getDbUser } from '@/lib/auth';
import { buildLoginPath } from '@/lib/auth-redirect';
import { getRequestPathForLoginNext } from '@/lib/auth-redirect.server';

const DESCRIPTION = 'Review mentions, due dates, and worklog pace alerts.';

export default async function NotificationsPage() {
  const dbUser = await getDbUser();
  if (!dbUser) {
    redirect(buildLoginPath(await getRequestPathForLoginNext()));
  }

  return (
    <DashboardShell description={DESCRIPTION}>
      <NotificationsPageClient userId={dbUser.id} />
    </DashboardShell>
  );
}
