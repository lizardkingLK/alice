'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { InfoTooltip } from '@repo/ui/components/ui/info-tooltip';
import { DashboardPageActions } from './dashboard-page-actions';
import {
  DashboardBreadcrumb,
  resolveDashboardBreadcrumbItems,
  resolveDashboardBreadcrumbTrail,
  type DashboardBreadcrumbOverride,
} from './dashboard-breadcrumb';
import {
  applyRuntimeBreadcrumbLabels,
  useDashboardBreadcrumbRuntime,
} from './dashboard-breadcrumb-runtime';

type DashboardPageMetaProps = {
  description?: string;
  breadcrumbOverrides?: DashboardBreadcrumbOverride[];
  breadcrumbAsTrail?: boolean;
  userId?: string | null;
  favoriteLabel?: string;
  projectId?: string | null;
};

const DEFAULT_OVERRIDES: DashboardBreadcrumbOverride[] = [
  { label: 'Dashboard', url: '/dashboard' },
];

export function DashboardPageMeta({
  description,
  breadcrumbOverrides = DEFAULT_OVERRIDES,
  breadcrumbAsTrail = false,
  userId = null,
  favoriteLabel,
  projectId = null,
}: Readonly<DashboardPageMetaProps>) {
  const pathname = usePathname();
  const runtime = useDashboardBreadcrumbRuntime();

  const resolvedOverrides = useMemo(() => {
    if (runtime?.trailOverride && runtime.trailOverride.length > 0) {
      return applyRuntimeBreadcrumbLabels(
        runtime.trailOverride,
        runtime.segmentLabelsByUrl
      );
    }
    const base = breadcrumbAsTrail
      ? resolveDashboardBreadcrumbTrail(breadcrumbOverrides)
      : resolveDashboardBreadcrumbItems(pathname, breadcrumbOverrides);
    return applyRuntimeBreadcrumbLabels(base, runtime?.segmentLabelsByUrl);
  }, [
    breadcrumbAsTrail,
    breadcrumbOverrides,
    pathname,
    runtime?.segmentLabelsByUrl,
    runtime?.trailOverride,
  ]);

  const breadcrumbLabel = resolvedOverrides.at(-1)?.label ?? pathname;
  const resolvedFavoriteLabel = runtime?.favoriteLabel?.trim() || favoriteLabel;

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <div className="min-w-0 overflow-hidden">
        <DashboardBreadcrumb overrides={resolvedOverrides} asTrail />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <DashboardPageActions
          userId={userId}
          favoriteLabel={resolvedFavoriteLabel}
          projectId={projectId}
          favoritesReady={runtime?.favoritesReady ?? true}
          breadcrumbLabel={breadcrumbLabel}
        />

        {description ? (
          <InfoTooltip
            ariaLabel="Page description"
            side="bottom"
            size="icon-sm"
          >
            {description}
          </InfoTooltip>
        ) : null}
      </div>
    </div>
  );
}
