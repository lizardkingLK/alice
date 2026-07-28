import { ManagerData } from '@/app/manager/_components/manager-data';
import {
  REGISTRY_PAGES,
  RegistrySuspensePage,
} from '@/components/registry-page-shell';
import type { RawSearchParams } from '@/lib/search-params';

export default function ManagerDashboardPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<RawSearchParams>;
}>) {
  return (
    <RegistrySuspensePage meta={REGISTRY_PAGES.manager}>
      <ManagerData searchParams={searchParams} />
    </RegistrySuspensePage>
  );
}
