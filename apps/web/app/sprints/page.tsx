import { Metadata } from 'next';
import { SprintsData } from '@/app/sprints/_components/sprints-data';
import {
  REGISTRY_PAGES,
  RegistrySuspensePage,
} from '@/components/registry-page-shell';
import type { RawSearchParams } from '@/lib/search-params';

export const metadata: Metadata = {
  title: 'Sprints',
  robots: {
    index: false,
    follow: false,
  },
};

export default function SprintsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<RawSearchParams>;
}>) {
  return (
    <RegistrySuspensePage meta={REGISTRY_PAGES.sprints}>
      <SprintsData searchParams={searchParams} />
    </RegistrySuspensePage>
  );
}
