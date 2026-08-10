'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { Info } from '@repo/ui/lib/icons';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import { Button } from '@repo/ui/components/ui/button';
import { DashboardPageActions } from './dashboard-page-actions';
import {
  DashboardBreadcrumb,
  resolveDashboardBreadcrumbItems,
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
    const items = resolveDashboardBreadcrumbItems(
      pathname,
      breadcrumbOverrides,
      breadcrumbAsTrail
    );
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
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground size-7 shrink-0"
              aria-label="Page description"
            >
              <Info className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            {description}
          </TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}
