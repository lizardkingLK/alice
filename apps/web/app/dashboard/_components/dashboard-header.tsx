import { SidebarTrigger } from '@repo/ui/components/ui/sidebar';
import { DashboardPageMeta } from './dashboard-page-meta';
import { AuthControls } from '@/app/dashboard/_components/dashboard-auth';
import { NotificationInbox } from '@/app/dashboard/_components/dashboard-notifications';
import { getUser } from '@/lib/auth';
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

  if (!user) {
    redirect('/login');
  }

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
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
        <NotificationInbox />
      </section>
      <section>
        <AuthControls email={user.email} meta={user.user_metadata} />
      </section>
    </header>
  );
}
