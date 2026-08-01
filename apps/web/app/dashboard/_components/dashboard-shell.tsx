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
  contentClassName?: string;
};

export async function DashboardShell({
  description,
  breadcrumbOverrides,
  breadcrumbAsTrail,
  children,
  sidebarDefaultOpen = true,
  contentClassName,
}: Readonly<DashboardShellProps>) {
  const dbUser = await getDbUser();

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={sidebarDefaultOpen}>
        <DashboardSidebar userId={dbUser?.id ?? null} />
        <SidebarInset>
          <DashboardHeader
            description={description}
            breadcrumbOverrides={breadcrumbOverrides}
            breadcrumbAsTrail={breadcrumbAsTrail}
          />
          <div
            className={cn(
              'flex flex-1 flex-col overflow-y-auto p-6',
              contentClassName
            )}
          >
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
