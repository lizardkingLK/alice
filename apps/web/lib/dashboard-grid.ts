'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useContainerWidth,
  type EventCallback,
  type LayoutItem,
} from 'react-grid-layout';
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
 * Snapshot layout on drag start; Esc restores it and remounts the grid so the
 * in-progress drag ends (react-grid-layout has no built-in cancel).
 */
export function useCancelGridDragOnEscape(
  // eslint-disable-next-line no-unused-vars -- layout restore
  onRestoreLayout: (layout: LayoutItem[]) => void
): {
  readonly dragSessionKey: number;
  readonly onDragStart: EventCallback;
  readonly onDragStop: EventCallback;
} {
  const layoutBeforeDragRef = useRef<LayoutItem[] | null>(null);
  const isDraggingRef = useRef(false);
  const [dragSessionKey, setDragSessionKey] = useState(0);

  const onDragStart = useCallback<EventCallback>((currentLayout) => {
    isDraggingRef.current = true;
    layoutBeforeDragRef.current = currentLayout.map((item) => ({ ...item }));
  }, []);

  const onDragStop = useCallback<EventCallback>(() => {
    isDraggingRef.current = false;
    layoutBeforeDragRef.current = null;
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !isDraggingRef.current) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();

      const snapshot = layoutBeforeDragRef.current;
      isDraggingRef.current = false;
      layoutBeforeDragRef.current = null;

      if (snapshot) {
        onRestoreLayout(snapshot);
      }

      // Release react-draggable pointer capture, then remount the grid.
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      setDragSessionKey((value) => value + 1);
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onRestoreLayout]);

  return { dragSessionKey, onDragStart, onDragStop };
}

/**
 * Freeze measured grid width while the sidebar CSS transition runs, then snap.
 * Remeasures after settle so Charts/Overview pick up width released by collapse.
 */
export function useStableDashboardGridWidth(initialWidth = 1200): {
  readonly stableWidth: number;
  readonly containerRef: ReturnType<typeof useContainerWidth>['containerRef'];
  readonly mounted: boolean;
  readonly isSidebarSettling: boolean;
} {
  const { width, containerRef, mounted, measureWidth } = useContainerWidth({
    initialWidth,
    measureBeforeMount: true,
  });
  const isSidebarSettling = useSidebarLayoutSettling();
  const [stableWidth, setStableWidth] = useState(width);

  useEffect(() => {
    if (isSidebarSettling) {
      return;
    }
    setStableWidth(width);
  }, [width, isSidebarSettling]);

  useEffect(() => {
    if (isSidebarSettling) {
      return;
    }
    let innerRaf = 0;
    const outerRaf = window.requestAnimationFrame(() => {
      innerRaf = window.requestAnimationFrame(() => {
        measureWidth();
      });
    });
    return () => {
      window.cancelAnimationFrame(outerRaf);
      window.cancelAnimationFrame(innerRaf);
    };
  }, [isSidebarSettling, measureWidth]);

  return { stableWidth, containerRef, mounted, isSidebarSettling };
}
