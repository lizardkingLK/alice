import {
  REGISTRY_PAGES,
  RegistryLoadingPage,
} from '@/components/registry-page-shell';

export default function ManagerLoading() {
  return <RegistryLoadingPage meta={REGISTRY_PAGES.manager} />;
}
