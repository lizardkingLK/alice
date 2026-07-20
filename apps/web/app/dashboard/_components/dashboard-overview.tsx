'use client';

import { useEffect, useState } from 'react';
import ReactGridLayout, {
  useContainerWidth,
  type Layout,
  type LayoutItem,
} from 'react-grid-layout';
import { Button } from '@repo/ui/components/ui/button';
import { RotateCcw } from '@repo/ui/lib/icons';
import {
  DEFAULT_LAYOUT,
  LAYOUT_STORAGE_KEY,
  WIDGET_CATALOG,
  type WidgetId,
} from './dashboard-mock-data';
import { DashboardWidget } from './dashboard-widgets';
import 'react-grid-layout/css/styles.css';
import './dashboard-grid.css';

function isWidgetId(value: string): value is WidgetId {
  return WIDGET_CATALOG.some((widget) => widget.id === value);
}

function readStoredLayout(): LayoutItem[] {
  if (typeof window === 'undefined') {
    return [...DEFAULT_LAYOUT];
  }

  try {
    const raw = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) {
      return [...DEFAULT_LAYOUT];
    }

    const parsed = JSON.parse(raw) as LayoutItem[];
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
  } catch {
    return [...DEFAULT_LAYOUT];
  }
}

export function DashboardOverview() {
  const { width, containerRef, mounted } = useContainerWidth({
    initialWidth: 1200,
  });
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

    window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(nextLayout));
  };

  const handleResetLayout = () => {
    const nextLayout = DEFAULT_LAYOUT.map((item) => ({ ...item }));
    setLayout(nextLayout);
    window.localStorage.removeItem(LAYOUT_STORAGE_KEY);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium">Overview</p>
          <p className="text-muted-foreground text-sm">
            Hold the ellipsis to drag widgets. Resize from the bottom-right
            corner. Layout is saved in this browser.
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

      <div ref={containerRef} className="dashboard-grid w-full">
        {mounted ? (
          <ReactGridLayout
            className="layout"
            width={width}
            layout={layout}
            gridConfig={{
              cols: 12,
              rowHeight: 48,
              margin: [16, 16],
              containerPadding: [0, 0],
            }}
            dragConfig={{
              enabled: true,
              handle: '.widget-drag-handle',
            }}
            resizeConfig={{
              enabled: true,
              handles: ['se'],
            }}
            onLayoutChange={handleLayoutChange}
          >
            {layout.map((item) => (
              <div key={item.i} className="dashboard-widget-root">
                <DashboardWidget id={item.i as WidgetId} />
              </div>
            ))}
          </ReactGridLayout>
        ) : (
          <div className="bg-muted/20 h-[28rem] animate-pulse rounded-xl" />
        )}
      </div>
    </div>
  );
}
