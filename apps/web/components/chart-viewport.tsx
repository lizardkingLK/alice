'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChartContainer, type ChartConfig } from '@repo/ui/components/ui/chart';
import { cn } from '@repo/ui/lib/utils';

type ChartSize = {
  width: number;
  height: number;
};

type ChartViewportProps = {
  readonly config: ChartConfig;
  readonly children: ReactNode;
  readonly className?: string;
  /** Constrain measured size to a square (pie charts). */
  readonly square?: boolean;
  /**
   * Coalesce ResizeObserver updates (e.g. sidebar/grid transitions).
   * `0` applies measurements immediately.
   */
  readonly settleMs?: number;
  readonly chartClassName?: string;
};

/**
 * Measures a flex/grid slot and feeds pixel size into ChartContainer.
 * Shared by Overview widgets and Charts pie preview.
 */
export function ChartViewport({
  config,
  children,
  className,
  square = false,
  settleMs = 0,
  chartClassName,
}: Readonly<ChartViewportProps>) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<ChartSize | null>(null);
  const pendingSizeRef = useRef<ChartSize | null>(null);
  const settleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) {
      return;
    }

    const applySize = (next: ChartSize) => {
      setSize((previous) => {
        if (previous?.width === next.width && previous.height === next.height) {
          return previous;
        }
        return next;
      });
    };

    const measure = (): ChartSize | null => {
      const { width, height } = element.getBoundingClientRect();
      if (square) {
        const side = Math.floor(Math.min(width, height));
        if (side <= 0) {
          return null;
        }
        return { width: side, height: side };
      }

      const nextWidth = Math.floor(width);
      const nextHeight = Math.floor(height);
      if (nextWidth <= 0 || nextHeight <= 0) {
        return null;
      }
      return { width: nextWidth, height: nextHeight };
    };

    const scheduleSizeUpdate = () => {
      const next = measure();
      if (!next) {
        return;
      }

      if (settleMs <= 0) {
        applySize(next);
        return;
      }

      pendingSizeRef.current = next;
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
      }

      settleTimerRef.current = window.setTimeout(() => {
        settleTimerRef.current = null;
        if (pendingSizeRef.current) {
          applySize(pendingSizeRef.current);
        }
      }, settleMs);
    };

    const initial = measure();
    if (initial) {
      applySize(initial);
    }

    const observer = new ResizeObserver(scheduleSizeUpdate);
    observer.observe(element);

    return () => {
      observer.disconnect();
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
      }
    };
  }, [settleMs, square]);

  return (
    <div ref={viewportRef} className={cn('relative', className)}>
      {size ? (
        <ChartContainer
          config={config}
          width={size.width}
          height={size.height}
          className={cn(
            'aspect-auto h-full w-full justify-center',
            square && 'absolute inset-0 m-auto',
            chartClassName
          )}
        >
          {children}
        </ChartContainer>
      ) : null}
    </div>
  );
}
