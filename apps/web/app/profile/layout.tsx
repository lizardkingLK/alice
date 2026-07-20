import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Profile',
  robots: {
    index: false,
    follow: false,
  },
};

export default function ProfileLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <section>{children}</section>;
}
