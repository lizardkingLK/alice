'use client';

import { useEffect, useRef, useState } from 'react';
import { useSidebar } from '@repo/ui/components/ui/sidebar';

/** Matches sidebar `duration-200` plus a short settle buffer. */
export const SIDEBAR_LAYOUT_SETTLE_MS = 250;

/**
 * True for a brief window after the sidebar expands/collapses so heavy
 * layout consumers (grid, charts) can freeze instead of resizing every frame.
 */
export function useSidebarLayoutSettling(
  settleMs: number = SIDEBAR_LAYOUT_SETTLE_MS
): boolean {
  const { state, isMobile } = useSidebar();
  const [isSettling, setIsSettling] = useState(false);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isMobile) {
      setIsSettling(false);
      return;
    }

    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    setIsSettling(true);
    const timer = window.setTimeout(() => {
      setIsSettling(false);
    }, settleMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [state, isMobile, settleMs]);

  return isSettling;
}
