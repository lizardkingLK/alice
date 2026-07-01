import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Reset Password',
  robots: { index: false, follow: false },
};

type ResetPasswordLayoutProps = {
  children: ReactNode;
};

export default async function ResetPasswordLayout({
  children,
}: Readonly<ResetPasswordLayoutProps>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/forgot-password');
  }

  return children;
}
