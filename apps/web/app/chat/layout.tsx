import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Alice',
  robots: {
    index: false,
    follow: false,
  },
};

export default function ChatLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return children;
}
