import type { ReactNode } from 'react';
import {
  RoleGatedLayout,
  roleGatedPageMetadata,
} from '@/lib/rbac/role-gated-layout';

export const metadata = roleGatedPageMetadata('Users');

export default async function UsersLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <RoleGatedLayout minimum="admin">{children}</RoleGatedLayout>;
}
