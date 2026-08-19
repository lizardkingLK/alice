import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getDbUser } from '@/lib/auth';
import { buildLoginPath } from '@/lib/auth-redirect';
import { getRequestPathForLoginNext } from '@/lib/auth-redirect.server';
import { roleGatedPageMetadata } from '@/lib/rbac/role-gated-layout';

export const metadata = roleGatedPageMetadata('Calendar');

export default async function CalendarLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const user = await getDbUser();
  if (!user) {
    redirect(buildLoginPath(await getRequestPathForLoginNext()));
  }

  return <section>{children}</section>;
}
