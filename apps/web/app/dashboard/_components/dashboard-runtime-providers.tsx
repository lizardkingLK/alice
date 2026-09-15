'use client';

import type { ReactNode } from 'react';
import { DashboardBreadcrumbRuntimeProvider } from './dashboard-breadcrumb-runtime';

/** Lifts breadcrumb runtime context above header + page content. */
export function DashboardRuntimeProviders({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <DashboardBreadcrumbRuntimeProvider>
      {children}
    </DashboardBreadcrumbRuntimeProvider>
  );
}
