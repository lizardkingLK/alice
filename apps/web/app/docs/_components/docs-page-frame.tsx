import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { DocsShell } from '@/app/docs/_components/docs-shell';
import {
  getDocsIndex,
  getDocsSections,
  getDocsShellDescription,
} from '@/app/docs/_lib/docs';
import type { DashboardBreadcrumbOverride } from '@/app/dashboard/_components/dashboard-breadcrumb';

export const DOCS_ROBOTS: NonNullable<Metadata['robots']> = {
  index: false,
  follow: false,
};

type DocsPageFrameProps = {
  readonly children: ReactNode;
  readonly breadcrumbOverrides?: DashboardBreadcrumbOverride[];
  readonly breadcrumbAsTrail?: boolean;
};

/** Shared DashboardShell + DocsShell chrome for /docs routes. */
export async function DocsPageFrame({
  children,
  breadcrumbOverrides,
  breadcrumbAsTrail,
}: DocsPageFrameProps) {
  const sections = await getDocsSections();
  const entries = await getDocsIndex();

  return (
    <DashboardShell
      description={getDocsShellDescription()}
      contentClassName="p-4 sm:p-6"
      breadcrumbOverrides={breadcrumbOverrides}
      breadcrumbAsTrail={breadcrumbAsTrail}
      sidebarDefaultOpen={false}
      stickyHeader
    >
      <DocsShell sections={sections} entries={entries}>
        {children}
      </DocsShell>
    </DashboardShell>
  );
}
