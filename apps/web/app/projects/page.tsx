import { ProjectsData } from '@/app/projects/_components/projects-data';
import {
  REGISTRY_PAGES,
  RegistrySuspensePage,
} from '@/components/registry-page-shell';
import type { RawSearchParams } from '@/lib/search-params';

export default function ProjectsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<RawSearchParams>;
}>) {
  return (
    <RegistrySuspensePage meta={REGISTRY_PAGES.projects}>
      <ProjectsData searchParams={searchParams} />
    </RegistrySuspensePage>
  );
}
