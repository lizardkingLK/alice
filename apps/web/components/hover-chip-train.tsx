'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@repo/ui/lib/utils';

/** Constant scroll speed so wide and narrow strips feel the same. */
export const CHIP_TRAIN_PX_PER_SEC = 32;

type HoverChipTrainProps = {
  /** Single chip strip; duplicated when overflowing for a seamless loop. */
  readonly children: ReactNode;
  /** Remeasure when strip identity changes (ids / labels). */
  readonly contentKey?: string;
  readonly className?: string;
  readonly title?: string;
};

/**
 * Clips a horizontal chip strip to the viewport. When content overflows,
 * hovering starts an infinite right-to-left “train”; leaving resets to start.
 * Duration scales with strip width so speed stays constant.
 */
export function HoverChipTrain({
  children,
  contentKey,
  className,
  title,
}: Readonly<HoverChipTrainProps>) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [stripWidthPx, setStripWidthPx] = useState(0);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    const viewport = viewportRef.current;
    const measure = measureRef.current;
    if (!viewport || !measure) {
      return;
    }

    const update = () => {
      // Viewport must be width-constrained by the parent; shrink-wrap alone
      // never trips overflow.
      const viewportWidth = viewport.clientWidth;
      const stripWidth = measure.scrollWidth;
      setStripWidthPx(stripWidth);
      setOverflows(viewportWidth > 0 && stripWidth > viewportWidth + 1);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    observer.observe(measure);
    return () => observer.disconnect();
  }, [contentKey]);

  const trainDurationSec =
    stripWidthPx > 0 ? stripWidthPx / CHIP_TRAIN_PX_PER_SEC : 8;

  return (
    <div
      ref={viewportRef}
      data-slot="hover-chip-train"
      data-overflows={overflows ? 'true' : 'false'}
      className={cn('relative min-w-0 overflow-hidden', className)}
      title={title}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div
        ref={measureRef}
        data-slot="hover-chip-train-measure"
        className="pointer-events-none absolute top-0 left-0 -z-10 opacity-0"
        aria-hidden
      >
        {children}
      </div>

      {overflows ? (
        <div
          className={cn(
            'flex w-max items-center',
            hovering && 'animate-labels-train'
          )}
          style={
            hovering ? { animationDuration: `${trainDurationSec}s` } : undefined
          }
        >
          {children}
          <div className="pointer-events-none" aria-hidden>
            {children}
          </div>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
