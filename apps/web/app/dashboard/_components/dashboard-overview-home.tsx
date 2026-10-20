'use client';

import { useEffect, useState } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import { SlidersHorizontal } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { DashboardChartsSlider } from '@/app/dashboard/_components/dashboard-charts-slider';
import { ProductivityCustomizeDialog } from '@/app/dashboard/_components/productivity/productivity-customize-dialog';
import { ProductivityDashboard } from '@/app/dashboard/_components/productivity/productivity-dashboard';
import {
  readProductivityDashboardPreferencesLocal,
  writeProductivityDashboardPreferences,
  type ProductivityDashboardPreferences,
} from '@/app/dashboard/_helpers/productivity-dashboard-preferences';
import type { ProductivityDashboardBootstrap } from '@/app/dashboard/_types/productivity-dashboard.types';
import type { ChartWorkspaceRecord } from '@/app/charts/_components/charts.types';
import type { PrefetchedChartSeriesEntry } from '@/app/charts/_helpers/charts-series-cache-key';

type DashboardOverviewHomeProps = {
  readonly userId: string;
  readonly slides: readonly ChartWorkspaceRecord[];
  readonly accessibleProjects?: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
  }>;
  readonly accessibleSprints?: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly projectId: string;
  }>;
  readonly productivityBootstrap: ProductivityDashboardBootstrap;
  readonly initialPreferences: ProductivityDashboardPreferences;
  /** RSC-prefetched pie series for the first Overview chart slide. */
  readonly prefetchedChartSeries?: readonly PrefetchedChartSeriesEntry[];
};

export function DashboardOverviewHome({
  userId,
  slides,
  accessibleProjects = [],
  accessibleSprints = [],
  productivityBootstrap,
  initialPreferences,
  prefetchedChartSeries = [],
}: Readonly<DashboardOverviewHomeProps>) {
  const hasChartSlides = slides.length > 0;
  const [preferences, setPreferences] =
    useState<ProductivityDashboardPreferences>(initialPreferences);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [transitionKey, setTransitionKey] = useState(0);
  const [activeChartSlideId, setActiveChartSlideId] = useState<string | null>(
    slides[0]?.id ?? null
  );

  useEffect(() => {
    const local = readProductivityDashboardPreferencesLocal(userId);
    if (!local) {
      return;
    }
    setPreferences(local);
  }, [userId]);

  const chartsCustomizeHref = activeChartSlideId
    ? `/charts/${activeChartSlideId}`
    : null;

  const persistPreferences = (next: ProductivityDashboardPreferences) => {
    setPreferences(next);
    writeProductivityDashboardPreferences(userId, next);
    setTransitionKey((value) => value + 1);
  };

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-4">
      <div className="flex w-full shrink-0 items-center justify-end gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="cursor-pointer"
              aria-label="Customize Overview"
              onClick={() => setCustomizeOpen(true)}
            >
              <SlidersHorizontal className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Customize</TooltipContent>
        </Tooltip>
      </div>

      <div
        key={`${preferences.mode}-${transitionKey}`}
        className={cn(
          'flex min-h-0 w-full min-w-0 flex-1 flex-col',
          'animate-in fade-in-0 zoom-in-95 duration-200'
        )}
      >
        {preferences.mode === 'productivity' ? (
          <ProductivityDashboard
            userId={userId}
            bootstrap={productivityBootstrap}
            preferences={preferences}
          />
        ) : (
          <DashboardChartsSlider
            slides={slides}
            accessibleProjects={accessibleProjects}
            accessibleSprints={accessibleSprints}
            hideCustomizeButton
            onActiveSlideChange={setActiveChartSlideId}
            prefetchedChartSeries={prefetchedChartSeries}
          />
        )}
      </div>

      <ProductivityCustomizeDialog
        open={customizeOpen}
        onOpenChange={setCustomizeOpen}
        value={preferences}
        onChange={persistPreferences}
        chartsCustomizeHref={chartsCustomizeHref}
        hasChartSlides={hasChartSlides}
      />
    </div>
  );
}
