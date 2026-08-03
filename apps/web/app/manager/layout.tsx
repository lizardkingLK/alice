import type { ReactNode } from 'react';
import {
  RoleGatedLayout,
  roleGatedPageMetadata,
} from '@/lib/rbac/role-gated-layout';

export const metadata = roleGatedPageMetadata('Team');

export default async function TeamsLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <RoleGatedLayout minimum="manager">{children}</RoleGatedLayout>;
}
