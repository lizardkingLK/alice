import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Notes',
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotesLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return children;
}
