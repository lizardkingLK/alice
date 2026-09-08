'use client';

import { useEffect, useState } from 'react';
import { useContainerWidth } from 'react-grid-layout';
import { useSidebarLayoutSettling } from '@/hooks/use-sidebar-layout-settling';

/** Shared react-grid-layout presets for Overview + Charts boards. */
export const DASHBOARD_GRID_CONFIG = {
  cols: 12,
  rowHeight: 48,
  margin: [16, 16] as [number, number],
  containerPadding: [0, 0] as [number, number],
};

export const DASHBOARD_DRAG_CONFIG = {
  enabled: true,
  handle: '.widget-drag-handle',
};

export const DASHBOARD_RESIZE_CONFIG = {
  enabled: true,
  handles: ['se'] as Array<'se'>,
};

/**
 * Freeze measured grid width while the sidebar CSS transition runs, then snap.
 */
export function useStableDashboardGridWidth(initialWidth = 1200): {
  readonly stableWidth: number;
  readonly containerRef: ReturnType<typeof useContainerWidth>['containerRef'];
  readonly mounted: boolean;
  readonly isSidebarSettling: boolean;
} {
  const { width, containerRef, mounted } = useContainerWidth({
    initialWidth,
  });
  const isSidebarSettling = useSidebarLayoutSettling();
  const [stableWidth, setStableWidth] = useState(width);

  useEffect(() => {
    if (!isSidebarSettling) {
      setStableWidth(width);
    }
  }, [width, isSidebarSettling]);

  return { stableWidth, containerRef, mounted, isSidebarSettling };
}
