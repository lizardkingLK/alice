'use client';

import type { ReactNode } from 'react';
import { DashboardBreadcrumbRuntimeProvider } from './dashboard-breadcrumb-runtime';
import { SessionExpiredDialogHost } from './session-expired-dialog-host';

/** Lifts breadcrumb runtime context above header + page content. */
export function DashboardRuntimeProviders({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <DashboardBreadcrumbRuntimeProvider>
      {children}
      <SessionExpiredDialogHost />
    </DashboardBreadcrumbRuntimeProvider>
  );
}
