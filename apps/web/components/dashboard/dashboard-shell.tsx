import type { ReactNode } from 'react';
import {
  SidebarInset,
  SidebarProvider,
} from '@repo/ui/components/ui/sidebar';
import {
  TooltipProvider,
} from '@repo/ui/components/ui/tooltip';
import { DashboardHeader } from './dashboard-header';
import { DashboardSidebar } from './dashboard-sidebar';

type DashboardShellProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function DashboardShell({
  title,
  description,
  children,
}: DashboardShellProps) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <DashboardSidebar />
        <SidebarInset>
          <DashboardHeader title={title} description={description} />
          <div className="flex flex-1 flex-col overflow-y-auto p-6">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
