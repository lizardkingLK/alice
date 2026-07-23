import {
  REGISTRY_PAGES,
  RegistryLoadingPage,
} from '@/components/registry-page-shell';

export default function UsersLoading() {
  return <RegistryLoadingPage meta={REGISTRY_PAGES.users} />;
}
