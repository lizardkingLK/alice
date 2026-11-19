import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Notifications',
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotificationsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <section>{children}</section>;
}
