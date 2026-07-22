import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Comments - Jira Teams',
  description: 'View, search, and join discussions across all project work items.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function CommentsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <section>{children}</section>;
}
