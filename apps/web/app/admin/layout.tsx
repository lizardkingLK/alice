import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Admin',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <section>{children}</section>;
}
