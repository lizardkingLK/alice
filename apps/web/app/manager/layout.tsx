import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Manager',
  robots: {
    index: false,
    follow: false,
  },
};

export default function ManagerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <section>{children}</section>;
}
