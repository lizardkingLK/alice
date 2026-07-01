import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Member',
  robots: {
    index: false,
    follow: false,
  },
};

export default function MemberLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <section>{children}</section>;
}
