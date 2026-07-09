import type { Metadata } from 'next';
import {
  appDescription,
  appTitle,
  appTitleTemplate,
  baseUrl,
} from '@/app/_shared/values';
import React from 'react';
import { cn } from '@repo/ui/lib/utils';
import { geistMono, geistSans, inter } from '@/app/_config/fonts';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: appTitle,
    template: appTitleTemplate,
  },
  description: appDescription,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn('font-sans', inter.variable)}>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
