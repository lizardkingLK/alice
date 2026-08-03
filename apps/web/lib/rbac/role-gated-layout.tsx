import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import type { AppRole } from '@/lib/rbac/roles';
import { assertRoleOrRedirect } from '@/lib/rbac/require-role';

/** Shared no-index metadata for authenticated route segments. */
export function roleGatedPageMetadata(title: string): Metadata {
  return {
    title,
    robots: {
      index: false,
      follow: false,
    },
  };
}

/**
 * RSC layout body: enforce minimum role, then render children.
 * Keep per-route `layout.tsx` files (Next.js) as thin wrappers around this.
 */
export async function RoleGatedLayout({
  children,
  minimum,
}: Readonly<{
  children: ReactNode;
  minimum: AppRole;
}>) {
  await assertRoleOrRedirect(minimum);
  return <section>{children}</section>;
}
