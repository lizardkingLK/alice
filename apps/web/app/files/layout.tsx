import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Files',
  robots: {
    index: false,
    follow: false,
  },
};

export default function FilesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <section>{children}</section>;
}
