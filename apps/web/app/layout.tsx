import type { Metadata } from 'next';
import {
  appDescription,
  appTitle,
  appTitleTemplate,
  baseUrl,
} from '@/app/_shared/values';
import React from 'react';
import { cn } from '@repo/ui/lib/utils';
import { Toaster } from '@repo/ui/components/ui/sonner';
import { geistMono, geistSans, inter } from '@/app/_config/fonts';
import { OptimisticLockProvider } from '@/components/optimistic-lock/optimistic-lock-provider';
import { RealtimeProvider } from '@/components/realtime/realtime-provider';
import { getDbUser } from '@/lib/auth';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: appTitle,
    template: appTitleTemplate,
  },
  description: appDescription,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getDbUser();

  return (
    <html lang="en" className={cn('font-sans', inter.variable)}>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <RealtimeProvider authenticatedUserId={user?.id ?? null}>
          <OptimisticLockProvider>{children}</OptimisticLockProvider>
        </RealtimeProvider>
        <Toaster />
      </body>
    </html>
  );
}
