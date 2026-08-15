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
  const breadcrumbLabel = useMemo(() => {
    const items = breadcrumbAsTrail
      ? resolveDashboardBreadcrumbTrail(breadcrumbOverrides)
      : resolveDashboardBreadcrumbItems(pathname, breadcrumbOverrides);
    return items.at(-1)?.label ?? pathname;
  }, [breadcrumbAsTrail, breadcrumbOverrides, pathname]);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <DashboardBreadcrumb
        overrides={breadcrumbOverrides}
        asTrail={breadcrumbAsTrail}
      />

      <DashboardPageActions
        userId={userId}
        favoriteLabel={favoriteLabel}
        projectId={projectId}
        breadcrumbLabel={breadcrumbLabel}
      />

      {description ? (
        <InfoTooltip ariaLabel="Page description" side="bottom" size="icon-sm">
          {description}
        </InfoTooltip>
      ) : null}
    </div>
  );
}
