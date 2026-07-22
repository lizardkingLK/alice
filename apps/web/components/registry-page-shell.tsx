import { Suspense, type ReactNode } from 'react';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { RegistryPageSkeleton } from '@/components/registry-page-skeleton';

export type RegistrySkeletonProps = {
  readonly columnCount?: number;
  readonly rowCount?: number;
  readonly showTabs?: boolean;
};

export type RegistryPageMeta = {
  readonly description: string;
  readonly skeleton: RegistrySkeletonProps;
};

/** Shared shell copy + skeleton props for registry list routes. */
export const REGISTRY_PAGES = {
  users: {
    description:
      'Manage application users, assign workspace roles, and control access.',
    skeleton: { columnCount: 5, rowCount: 8 },
  },
  projects: {
    description: 'Organize project administration.',
    skeleton: { columnCount: 6, rowCount: 8, showTabs: true },
  },
  sprints: {
    description: 'Plan and track team sprints.',
    skeleton: { columnCount: 5, rowCount: 6, showTabs: true },
  },
  manager: {
    description: 'Manage teams workload and engineering resources.',
    skeleton: { columnCount: 6, rowCount: 8, showTabs: true },
  },
  workItems: {
    description: 'Manage Work Items.',
    skeleton: { columnCount: 7, rowCount: 8 },
  },
} as const satisfies Record<string, RegistryPageMeta>;

type RegistrySuspensePageProps = {
  readonly meta: RegistryPageMeta;
  readonly children: ReactNode;
};

/** Dashboard shell + Suspense fallback for registry list pages. */
export function RegistrySuspensePage({
  meta,
  children,
}: Readonly<RegistrySuspensePageProps>) {
  return (
    <DashboardShell description={meta.description}>
      <Suspense fallback={<RegistryPageSkeleton {...meta.skeleton} />}>
        {children}
      </Suspense>
    </DashboardShell>
  );
}

type RegistryLoadingPageProps = {
  readonly meta: RegistryPageMeta;
};

/** Instant loading UI that mirrors the Suspense fallback for a registry route. */
export function RegistryLoadingPage({
  meta,
}: Readonly<RegistryLoadingPageProps>) {
  return (
    <DashboardShell description={meta.description}>
      <RegistryPageSkeleton {...meta.skeleton} />
    </DashboardShell>
  );
}
