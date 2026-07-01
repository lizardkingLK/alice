import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Instruments',
  robots: {
    index: false,
    follow: false,
  },
};

export default function InstrumentsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <section>{children}</section>;
}
