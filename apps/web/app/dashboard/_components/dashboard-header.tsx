import { SidebarTrigger } from '@repo/ui/components/ui/sidebar';
import { DashboardPageMeta } from './dashboard-page-meta';
import { AuthControls } from '@/app/dashboard/_components/dashboard-auth';
import { NotificationInbox } from '@/app/dashboard/_components/dashboard-notifications';
import { getDbUser, getUser } from '@/lib/auth';
import { buildLoginPath } from '@/lib/auth-redirect';
import { getRequestPathForLoginNext } from '@/lib/auth-redirect.server';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { DashboardBreadcrumbOverride } from './dashboard-breadcrumb';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';

type DashboardHeaderProps = {
  description?: string;
  breadcrumbOverrides?: DashboardBreadcrumbOverride[];
  breadcrumbAsTrail?: boolean;
};

export async function DashboardHeader({
  description,
  breadcrumbOverrides,
  breadcrumbAsTrail,
}: Readonly<DashboardHeaderProps>) {
  const user = await getUser();
  const dbUser = await getDbUser();

  if (!user) {
    redirect(buildLoginPath(await getRequestPathForLoginNext()));
  }

  const supabase = await createClient();
  const NOTIFICATION_QUERY_TIMEOUT_MS = 5_000;
  const { data: initialNotifications, error: notificationsError } =
    await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(50)
      .abortSignal(AbortSignal.timeout(NOTIFICATION_QUERY_TIMEOUT_MS));

  const notificationsLoadFailed = Boolean(notificationsError);
  if (notificationsError) {
    console.error(
      'error. failed to load dashboard notifications:',
      notificationsError.message
    );
  }

  return (
    <header className="bg-background flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarTrigger className="-ml-1 cursor-pointer" />
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>⌘B</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DashboardPageMeta
        description={description}
        breadcrumbOverrides={breadcrumbOverrides}
        breadcrumbAsTrail={breadcrumbAsTrail}
      />
      <section>
        <NotificationInbox
          userId={user.id}
          initialNotifications={initialNotifications ?? []}
          initialLoadFailed={notificationsLoadFailed}
        />
      </section>
      <section>
        <AuthControls
          email={user.email}
          name={dbUser?.name}
          role={dbUser?.role}
          profilePicture={dbUser?.profile_picture}
        />
      </section>
    </header>
  );
}
