import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Projects',
  robots: {
    index: false,
    follow: false,
  },
};

export default function ProjectsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <section>{children}</section>;
}
