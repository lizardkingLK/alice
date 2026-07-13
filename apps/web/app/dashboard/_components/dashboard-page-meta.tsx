'use client';

import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import {
  DashboardBreadcrumb,
  type DashboardBreadcrumbOverride,
} from './dashboard-breadcrumb';

type DashboardPageMetaProps = {
  description?: string;
  breadcrumbOverrides?: DashboardBreadcrumbOverride[];
};

export function DashboardPageMeta({
  description,
  breadcrumbOverrides = [{ label: 'Dashboard', url: '/dashboard' }],
}: Readonly<DashboardPageMetaProps>) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <DashboardBreadcrumb overrides={breadcrumbOverrides} />

      {description ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground inline-flex size-7 shrink-0 items-center justify-center rounded-md transition-colors"
              aria-label="Page description"
            >
              <Info className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            {description}
          </TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}
