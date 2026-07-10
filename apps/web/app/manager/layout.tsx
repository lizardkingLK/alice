import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Team',
  robots: {
    index: false,
    follow: false,
  },
};

export default function TeamsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <section>{children}</section>;
}
