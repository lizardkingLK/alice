import type { ReactNode } from 'react';
import { SidebarInset, SidebarProvider } from '@repo/ui/components/ui/sidebar';
import { TooltipProvider } from '@repo/ui/components/ui/tooltip';
import { DashboardHeader } from './dashboard-header';
import { DashboardSidebar } from './dashboard-sidebar';
import { getUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import type { DashboardBreadcrumbOverride } from './dashboard-breadcrumb';

type DashboardShellProps = {
  description?: string;
  breadcrumbOverrides?: DashboardBreadcrumbOverride[];
  children: ReactNode;
};

export async function DashboardShell({
  description,
  breadcrumbOverrides,
  children,
}: Readonly<DashboardShellProps>) {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <TooltipProvider>
      <SidebarProvider>
        <DashboardSidebar />
        <SidebarInset>
          <DashboardHeader
            description={description}
            breadcrumbOverrides={breadcrumbOverrides}
          />
          <div className="flex flex-1 flex-col overflow-y-auto p-6">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
