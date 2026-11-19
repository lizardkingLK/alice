'use client';

import type { ReactNode } from 'react';
import { SoftInvalidateProvider } from '@/components/soft-invalidate/soft-invalidate-provider';
import { DashboardBreadcrumbRuntimeProvider } from './dashboard-breadcrumb-runtime';
import { SessionExpiredDialogHost } from './session-expired-dialog-host';

/** Lifts breadcrumb runtime context above header + page content. */
export function DashboardRuntimeProviders({
  userId,
  initialRole,
  children,
}: Readonly<{
  userId: string | null;
  initialRole: string | null;
  children: ReactNode;
}>) {
  return (
    <DashboardBreadcrumbRuntimeProvider>
      <SoftInvalidateProvider userId={userId} initialRole={initialRole}>
        {children}
        <SessionExpiredDialogHost />
      </SoftInvalidateProvider>
    </DashboardBreadcrumbRuntimeProvider>
  );
}
