'use client';

import type { ReactNode } from 'react';
import { SidebarInset, SidebarProvider } from '@repo/ui/components/ui/sidebar';
import { TooltipProvider } from '@repo/ui/components/ui/tooltip';
import { DashboardSidebar } from '@/app/dashboard/_components/dashboard-sidebar';
import { ErrorPageContent } from '@/lib/errors/error-page-content';

type DashboardErrorShellProps = {
  children: ReactNode;
};

/**
 * Client-safe dashboard chrome for `error.tsx` (async `DashboardShell` cannot
 * be used in client error boundaries).
 */
export function DashboardErrorShell({
  children,
}: Readonly<DashboardErrorShellProps>) {
  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen>
        <DashboardSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <p className="text-muted-foreground text-sm">
              Something went wrong
            </p>
          </header>
          <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto p-6">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

type DashboardSegmentErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * Shared segment `error.tsx` body: dashboard shell + recovery actions.
 */
export function DashboardSegmentError({
  error,
  reset,
}: Readonly<DashboardSegmentErrorProps>) {
  return (
    <DashboardErrorShell>
      <ErrorPageContent
        error={error}
        reset={reset}
        secondaryHref="/dashboard"
        secondaryLabel="Back to dashboard"
      />
    </DashboardErrorShell>
  );
}

/** Default export for thin per-route `error.tsx` re-exports. */
export default function DashboardSegmentErrorPage({
  error,
  reset,
}: Readonly<DashboardSegmentErrorProps>) {
  return <DashboardSegmentError error={error} reset={reset} />;
}
