import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Charts',
  robots: {
    index: false,
    follow: false,
  },
};

export default function ChartsLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return children;
}
