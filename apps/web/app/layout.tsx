import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { ClerkProvider } from '@clerk/nextjs';
import { Inter } from 'next/font/google';
import { cn } from '@repo/ui/lib/utils';
import React from 'react';
const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
});
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
});

export const metadata: Metadata = {
  title: 'Jira Teams',
  description: 'A Jira Clone',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className={cn('font-sans', inter.variable)}>
        <body className={`${geistSans.variable} ${geistMono.variable}`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
