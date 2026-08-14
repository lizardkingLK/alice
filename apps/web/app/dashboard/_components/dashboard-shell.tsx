import type { ReactNode } from 'react';
import { SidebarInset, SidebarProvider } from '@repo/ui/components/ui/sidebar';
import { TooltipProvider } from '@repo/ui/components/ui/tooltip';
import { cn } from '@repo/ui/lib/utils';
import { getDbUser } from '@/lib/auth';
import { DashboardHeader } from './dashboard-header';
import { DashboardSidebar } from './dashboard-sidebar';
import type { DashboardBreadcrumbOverride } from './dashboard-breadcrumb';
import { ChatLauncherProvider } from '@/app/chat/_components/chat-launcher';

type DashboardShellProps = {
  description?: string;
  breadcrumbOverrides?: DashboardBreadcrumbOverride[];
  /** When true, `breadcrumbOverrides` is rendered as the full crumb trail. */
  breadcrumbAsTrail?: boolean;
  /** Sidebar favorite label override (e.g. work-item title). */
  favoriteLabel?: string;
  /** Optional project scope for Save View share modes. */
  projectId?: string | null;
  children: ReactNode;
  /** When false, sidebar starts collapsed (icon rail). */
  sidebarDefaultOpen?: boolean;
  /**
   * When true, the top navbar stays pinned while page content scrolls.
   * Default false: header scrolls away with the page.
   */
  stickyHeader?: boolean;
  /**
   * When false, the shell content region does not scroll — the child owns
   * overflow (e.g. chat `ScrollArea`). Default true.
   */
  contentScrollable?: boolean;
  contentClassName?: string;
};

export async function DashboardShell({
  description,
  breadcrumbOverrides,
  breadcrumbAsTrail,
  favoriteLabel,
  projectId,
  children,
  sidebarDefaultOpen = true,
  stickyHeader = false,
  contentScrollable = true,
  contentClassName,
}: Readonly<DashboardShellProps>) {
  const dbUser = await getDbUser();

  const header = (
    <DashboardHeader
      description={description}
      breadcrumbOverrides={breadcrumbOverrides}
      breadcrumbAsTrail={breadcrumbAsTrail}
      favoriteLabel={favoriteLabel}
      projectId={projectId}
    />
  );

  const body = (
    <div className={cn('flex min-h-0 flex-1 flex-col p-6', contentClassName)}>
      {children}
    </div>
  );

  const scrollRegionClass = cn(
    'flex min-h-0 flex-1 flex-col',
    contentScrollable ? 'overflow-y-auto' : 'overflow-hidden'
  );

  return (
    <TooltipProvider>
      <SidebarProvider
        defaultOpen={sidebarDefaultOpen}
        className="h-svh overflow-hidden"
      >
        <DashboardSidebar
          userId={dbUser?.id ?? null}
          role={dbUser?.role ?? null}
        />
        <SidebarInset className="min-h-0 overflow-hidden">
          <ChatLauncherProvider
            currentUserName={dbUser?.name}
            currentUserImageUrl={dbUser?.profile_picture}
          >
            {stickyHeader ? (
              <>
                {header}
                <div className={scrollRegionClass}>{body}</div>
              </>
            ) : (
              <div className={scrollRegionClass}>
                {header}
                {body}
              </div>
            )}
          </ChatLauncherProvider>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
