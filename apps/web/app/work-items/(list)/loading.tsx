import {
  REGISTRY_PAGES,
  RegistryLoadingPage,
} from '@/components/registry-page-shell';

export default function WorkItemsLoading() {
  return <RegistryLoadingPage meta={REGISTRY_PAGES.workItems} />;
}
