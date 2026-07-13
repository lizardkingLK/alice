import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Work-Item',
  robots: {
    index: false,
    follow: false,
  },
};

export default function WorkItemLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <section>{children}</section>;
}
