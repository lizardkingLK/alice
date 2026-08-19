import { ViewsData } from '@/app/views/_components/views-data';
import {
  REGISTRY_PAGES,
  RegistrySuspensePage,
} from '@/components/registry-page-shell';
import type { RawSearchParams } from '@/lib/search-params';

export default function ViewsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<RawSearchParams>;
}>) {
  return (
    <RegistrySuspensePage meta={REGISTRY_PAGES.views}>
      <ViewsData searchParams={searchParams} />
    </RegistrySuspensePage>
  );
}
