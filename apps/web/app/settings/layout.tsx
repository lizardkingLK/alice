import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Settings',
  robots: {
    index: false,
    follow: false,
  },
};

export default function SettingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <section>{children}</section>;
}
