import { WorkItemsData } from '@/app/work-items/_components/work-items-data';
import { redirectLegacyGlobalFilterQuery } from '@/app/board/_helpers/redirect-legacy-filter-query';
import {
  REGISTRY_PAGES,
  RegistrySuspensePage,
} from '@/components/registry-page-shell';
import type { RawSearchParams } from '@/lib/search-params';

/**
 * Keep the shell sync so Suspense can paint immediately; await searchParams
 * only for the legacy UUID query → path redirect.
 */
export default async function WorkItemsDashboard({
  searchParams,
}: Readonly<{
  searchParams: Promise<RawSearchParams>;
}>) {
  const resolvedSearchParams = await searchParams;
  await redirectLegacyGlobalFilterQuery({
    area: 'work-items',
    searchParams: resolvedSearchParams,
  });

  return (
    <RegistrySuspensePage meta={REGISTRY_PAGES.workItems}>
      <WorkItemsData searchParams={Promise.resolve(resolvedSearchParams)} />
    </RegistrySuspensePage>
  );
}
