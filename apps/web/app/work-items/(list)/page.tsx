import { WorkItemsData } from '@/app/work-items/_components/work-items-data';
import {
  REGISTRY_PAGES,
  RegistrySuspensePage,
} from '@/components/registry-page-shell';
import type { RawSearchParams } from '@/lib/search-params';

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
