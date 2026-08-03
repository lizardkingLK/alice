import type { ReactNode } from 'react';
import {
  RoleGatedLayout,
  roleGatedPageMetadata,
} from '@/lib/rbac/role-gated-layout';

export const metadata = roleGatedPageMetadata('Sprints');

export default async function SprintsLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <RoleGatedLayout minimum="manager">{children}</RoleGatedLayout>;
}
