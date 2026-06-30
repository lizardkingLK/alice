import type { Metadata } from 'next';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Forgot Password',
  robots: { index: false, follow: false },
};

type ForgotPasswordLayoutProps = {
  children: ReactNode;
};

export default function ForgotPasswordLayout({
  children,
}: Readonly<ForgotPasswordLayoutProps>) {
  return children;
}
