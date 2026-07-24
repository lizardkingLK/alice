import {
  REGISTRY_PAGES,
  RegistryLoadingPage,
} from '@/components/registry-page-shell';

export default function ProjectsLoading() {
  return <RegistryLoadingPage meta={REGISTRY_PAGES.projects} />;
}
