'use client';

import { useEffect, useState } from 'react';
import ReactGridLayout, {
  type Layout,
  type LayoutItem,
} from 'react-grid-layout';
import { Button } from '@repo/ui/components/ui/button';
import { RotateCcw } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import {
  DASHBOARD_DRAG_CONFIG,
  DASHBOARD_GRID_CONFIG,
  DASHBOARD_RESIZE_CONFIG,
  useStableDashboardGridWidth,
} from '@/lib/dashboard-grid';
import {
  getLocalStorageJson,
  removeLocalStorageItem,
  setLocalStorageJson,
} from '@/lib/local-storage';
import {
  DEFAULT_LAYOUT,
  LAYOUT_STORAGE_KEY,
  WIDGET_CATALOG,
  type WidgetId,
} from './dashboard-mock-data';
import { DashboardWidget } from './dashboard-widgets';
import type { DashboardBurndownBootstrap } from '@/app/dashboard/_services/dashboard.reads.burndown.server';
import 'react-grid-layout/css/styles.css';
import './dashboard-grid.css';

function isWidgetId(value: string): value is WidgetId {
  return WIDGET_CATALOG.some((widget) => widget.id === value);
}

function readStoredLayout(): LayoutItem[] {
  const parsed = getLocalStorageJson<LayoutItem[]>(LAYOUT_STORAGE_KEY);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return [...DEFAULT_LAYOUT];
  }

  const byId = new Map(
    parsed.filter((item) => isWidgetId(item.i)).map((item) => [item.i, item])
  );

  return DEFAULT_LAYOUT.map((fallback) => {
    const stored = byId.get(fallback.i);
    if (!stored) {
      return { ...fallback };
    }

    return {
      ...fallback,
      x: stored.x,
      y: stored.y,
      w: stored.w,
      h: stored.h,
    };
  });
}

type DashboardOverviewProps = {
  readonly burndownBootstrap: DashboardBurndownBootstrap;
};

export function DashboardOverview({
  burndownBootstrap,
}: DashboardOverviewProps) {
  const { stableWidth, containerRef, mounted, isSidebarSettling } =
    useStableDashboardGridWidth();
  const [layout, setLayout] = useState<LayoutItem[]>(() => [...DEFAULT_LAYOUT]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setLayout(readStoredLayout());
    setHydrated(true);
  }, []);

  const handleLayoutChange = (next: Layout) => {
    const nextLayout = [...next];
    setLayout(nextLayout);

    if (!hydrated) {
      return;
    }

    setLocalStorageJson(LAYOUT_STORAGE_KEY, nextLayout);
  };

  const handleResetLayout = () => {
    const nextLayout = DEFAULT_LAYOUT.map((item) => ({ ...item }));
    setLayout(nextLayout);
    removeLocalStorageItem(LAYOUT_STORAGE_KEY);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium">Overview</p>
          <p className="text-muted-foreground text-sm">
            Hold the ellipsis to drag widgets. Resize from the bottom-right
            corner. Layout is saved automatically.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleResetLayout}
        >
          <RotateCcw className="size-3.5" />
          Reset layout
        </Button>
      </div>

      <div
        ref={containerRef}
        className={cn(
          'dashboard-grid w-full transition-opacity duration-150',
          isSidebarSettling && 'pointer-events-none opacity-80'
        )}
      >
        {mounted ? (
          <ReactGridLayout
            className="layout"
            width={stableWidth}
            layout={layout}
            gridConfig={DASHBOARD_GRID_CONFIG}
            dragConfig={DASHBOARD_DRAG_CONFIG}
            resizeConfig={DASHBOARD_RESIZE_CONFIG}
            onLayoutChange={handleLayoutChange}
          >
            {layout.map((item) => (
              <div key={item.i} className="dashboard-widget-root">
                <DashboardWidget
                  id={item.i as WidgetId}
                  burndownBootstrap={burndownBootstrap}
                />
              </div>
            ))}
          </ReactGridLayout>
        ) : (
          <div className="bg-muted/20 h-112 animate-pulse rounded-xl" />
        )}
      </div>
    </div>
  );
}
