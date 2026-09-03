import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getDbUser } from '@/lib/auth';
import { buildLoginPath } from '@/lib/auth-redirect';
import { getRequestPathForLoginNext } from '@/lib/auth-redirect.server';

/**
 * OAuth return pages and similar integration landings.
 * Any authenticated user may finish connecting their own Atlassian account.
 */
export default async function IntegrationsLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const user = await getDbUser();
  if (!user) {
    redirect(buildLoginPath(await getRequestPathForLoginNext()));
  }

  return <section>{children}</section>;
}
