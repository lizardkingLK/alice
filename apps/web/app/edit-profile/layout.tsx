import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Edit profile',
  robots: {
    index: false,
    follow: false,
  },
};

export default function EditProfileLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <section>{children}</section>;
}
