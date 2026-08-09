import { getWorkItemsRegistryPageMeta } from '@/app/work-items/_helpers/work-item-registry-skeleton.server';
import { RegistryLoadingPage } from '@/components/registry-page-shell';

export default async function WorkItemsLoading() {
  const meta = await getWorkItemsRegistryPageMeta();
  return <RegistryLoadingPage meta={meta} />;
}
