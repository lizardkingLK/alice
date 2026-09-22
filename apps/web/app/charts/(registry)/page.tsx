import { ChartsRegistryData } from '@/app/charts/_components/charts-registry-data';
import {
  RegistrySuspensePage,
  REGISTRY_PAGES,
} from '@/components/registry-page-shell';
import type { RawSearchParams } from '@/lib/search-params';

/**
 * Charts workspace registry — list, filter tabs, create, open boards.
 * Pass `searchParams` like other registry routes (Views / Work items).
 */
export default function ChartsIndexPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<RawSearchParams>;
}>) {
  return (
    <RegistrySuspensePage meta={REGISTRY_PAGES.charts}>
      <ChartsRegistryData searchParams={searchParams} />
    </RegistrySuspensePage>
  );
}
