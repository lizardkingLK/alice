import { UsersData } from '@/app/users/_components/users-data';
import {
  REGISTRY_PAGES,
  RegistrySuspensePage,
} from '@/components/registry-page-shell';
import type { RawSearchParams } from '@/lib/search-params';

export default function UsersDashboard({
  searchParams,
}: Readonly<{
  searchParams: Promise<RawSearchParams>;
}>) {
  return (
    <RegistrySuspensePage meta={REGISTRY_PAGES.users}>
      <UsersData searchParams={searchParams} />
    </RegistrySuspensePage>
  );
}
