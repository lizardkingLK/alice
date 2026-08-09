import { WorkItemsData } from '@/app/work-items/_components/work-items-data';
import {
  REGISTRY_PAGES,
  RegistrySuspensePage,
} from '@/components/registry-page-shell';
import type { RawSearchParams } from '@/lib/search-params';

/**
 * Keep this page sync: awaiting cookies here would delay the Suspense fallback
 * until the parent resolves. Cookie-accurate column counts live in `loading.tsx`.
 */
export default function WorkItemsDashboard({
  searchParams,
}: Readonly<{
  searchParams: Promise<RawSearchParams>;
}>) {
  return (
    <RegistrySuspensePage meta={REGISTRY_PAGES.workItems}>
      <WorkItemsData searchParams={searchParams} />
    </RegistrySuspensePage>
  );
}
