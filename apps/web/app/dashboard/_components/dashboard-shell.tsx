import type { ReactNode } from 'react';
import { SidebarInset, SidebarProvider } from '@repo/ui/components/ui/sidebar';
import { TooltipProvider } from '@repo/ui/components/ui/tooltip';
import { cn } from '@repo/ui/lib/utils';
import { DashboardHeader } from './dashboard-header';
import { DashboardSidebar } from './dashboard-sidebar';
import type { DashboardBreadcrumbOverride } from './dashboard-breadcrumb';

type DashboardShellProps = {
  description?: string;
  breadcrumbOverrides?: DashboardBreadcrumbOverride[];
  children: ReactNode;
  /** When false, sidebar starts collapsed (icon rail). */
  sidebarDefaultOpen?: boolean;
  contentClassName?: string;
};

export async function DashboardShell({
  description,
  breadcrumbOverrides,
  children,
  sidebarDefaultOpen = true,
  contentClassName,
}: Readonly<DashboardShellProps>) {
  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={sidebarDefaultOpen}>
        <DashboardSidebar />
        <SidebarInset>
          <DashboardHeader
            description={description}
            breadcrumbOverrides={breadcrumbOverrides}
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
