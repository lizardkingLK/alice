'use client';

import { useEffect, useMemo, useState } from 'react';
import ReactGridLayout, {
  type Layout,
  type LayoutItem,
} from 'react-grid-layout';
import { cn } from '@repo/ui/lib/utils';
import {
  DASHBOARD_DRAG_CONFIG,
  DASHBOARD_GRID_CONFIG,
  DASHBOARD_RESIZE_CONFIG,
  useStableDashboardGridWidth,
} from '@/lib/dashboard-grid';
import { getLocalStorageJson, setLocalStorageJson } from '@/lib/local-storage';
import { mergeStoredDashboardLayout } from '@/lib/dashboard-grid-layout';
import { PRODUCTIVITY_DEFAULT_LAYOUT } from '@/app/dashboard/_components/productivity/productivity-catalog';
import { ProductivityWidget } from '@/app/dashboard/_components/productivity/productivity-widgets';
import {
  PRODUCTIVITY_LAYOUT_STORAGE_KEY,
  PRODUCTIVITY_WIDGET_IDS,
  type ProductivityDashboardPreferences,
  type ProductivityWidgetId,
} from '@/app/dashboard/_helpers/productivity-dashboard-preferences';
import type { ProductivityDashboardBootstrap } from '@/app/dashboard/_types/productivity-dashboard.types';
import 'react-grid-layout/css/styles.css';
import '@/app/dashboard/_components/dashboard-grid.css';

function readStoredLayout(
  enabledIds: readonly ProductivityWidgetId[]
): LayoutItem[] {
  const enabled = new Set(enabledIds);
  const defaults = PRODUCTIVITY_DEFAULT_LAYOUT.filter((item) =>
    enabled.has(item.i as ProductivityWidgetId)
  );
  return mergeStoredDashboardLayout(
    defaults,
    getLocalStorageJson(PRODUCTIVITY_LAYOUT_STORAGE_KEY)
  );
}

type ProductivityDashboardProps = {
  readonly userId: string;
  readonly bootstrap: ProductivityDashboardBootstrap;
  readonly preferences: ProductivityDashboardPreferences;
};

export function ProductivityDashboard({
  userId,
  bootstrap,
  preferences,
}: Readonly<ProductivityDashboardProps>) {
  const enabledIds = useMemo(
    () => PRODUCTIVITY_WIDGET_IDS.filter((id) => preferences.widgets[id]),
    [preferences.widgets]
  );
  const { stableWidth, containerRef, mounted, isSidebarSettling } =
    useStableDashboardGridWidth();
  const [layout, setLayout] = useState<LayoutItem[]>(() =>
    PRODUCTIVITY_DEFAULT_LAYOUT.filter((item) =>
      enabledIds.includes(item.i as ProductivityWidgetId)
    ).map((item) => ({ ...item }))
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setLayout(readStoredLayout(enabledIds));
    setHydrated(true);
  }, [enabledIds]);

  const handleLayoutChange = (next: Layout) => {
    const nextLayout = [...next];
    setLayout(nextLayout);
    if (!hydrated) {
      return;
    }
    setLocalStorageJson(PRODUCTIVITY_LAYOUT_STORAGE_KEY, nextLayout);
  };

  if (enabledIds.length === 0) {
    return (
      <div className="border-border text-muted-foreground flex min-h-72 flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center text-sm">
        <p className="text-foreground font-medium">
          No productivity widgets on
        </p>
        <p>Turn widgets on from Customize.</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'dashboard-grid min-h-0 w-full min-w-0 flex-1 transition-opacity duration-150',
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
              <ProductivityWidget
                id={item.i as ProductivityWidgetId}
                userId={userId}
                bootstrap={bootstrap}
              />
            </div>
          ))}
        </ReactGridLayout>
      ) : (
        <div className="bg-muted/20 h-112 animate-pulse rounded-xl" />
      )}
    </div>
  );
}
