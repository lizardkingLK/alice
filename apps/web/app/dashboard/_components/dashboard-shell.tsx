import type { ReactNode } from 'react';
import { SidebarInset, SidebarProvider } from '@repo/ui/components/ui/sidebar';
import { TooltipProvider } from '@repo/ui/components/ui/tooltip';
import { cn } from '@repo/ui/lib/utils';
import { getDbUser } from '@/lib/auth';
import { DashboardHeader } from './dashboard-header';
import { DashboardSidebar } from './dashboard-sidebar';
import type { DashboardBreadcrumbOverride } from './dashboard-breadcrumb';

type DashboardShellProps = {
  description?: string;
  breadcrumbOverrides?: DashboardBreadcrumbOverride[];
  /** When true, `breadcrumbOverrides` is rendered as the full crumb trail. */
  breadcrumbAsTrail?: boolean;
  children: ReactNode;
  /** When false, sidebar starts collapsed (icon rail). */
  sidebarDefaultOpen?: boolean;
  /**
   * When true, the top navbar stays pinned while page content scrolls.
   * Default false: header scrolls away with the page.
   */
  stickyHeader?: boolean;
  contentClassName?: string;
};

export async function DashboardShell({
  description,
  breadcrumbOverrides,
  breadcrumbAsTrail,
  children,
  sidebarDefaultOpen = true,
  stickyHeader = false,
  contentClassName,
}: Readonly<DashboardShellProps>) {
  const dbUser = await getDbUser();

  const header = (
    <DashboardHeader
      description={description}
      breadcrumbOverrides={breadcrumbOverrides}
      breadcrumbAsTrail={breadcrumbAsTrail}
    />
  );

  const body = (
    <div className={cn('flex min-h-0 flex-1 flex-col p-6', contentClassName)}>
      {children}
    </div>
  );

  return (
    <TooltipProvider>
      <SidebarProvider
        defaultOpen={sidebarDefaultOpen}
        className="h-svh overflow-hidden"
      >
        <DashboardSidebar userId={dbUser?.id ?? null} />
        <SidebarInset className="min-h-0 overflow-hidden">
          {stickyHeader ? (
            <>
              {header}
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                {body}
              </div>
            </>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              {header}
              {body}
            </div>
          )}
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
