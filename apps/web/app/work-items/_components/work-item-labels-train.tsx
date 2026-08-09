'use client';

import { useEffect, useRef, useState } from 'react';
import { Badge } from '@repo/ui/components/ui/badge';
import { cn } from '@repo/ui/lib/utils';

/** Fixed labels cell width (Tailwind `w-36` = 9rem). */
const LABELS_VIEWPORT_CLASS = 'w-36';
/** Constant scroll speed so wide and narrow strips feel the same. */
const LABELS_TRAIN_PX_PER_SEC = 32;

function LabelsChipStrip({
  labels,
  ariaHidden,
}: Readonly<{
  labels: readonly string[];
  ariaHidden?: boolean;
}>) {
  return (
    <div
      className="flex shrink-0 items-center gap-1 pr-1"
      aria-hidden={ariaHidden || undefined}
    >
      {labels.map((label) => (
        <Badge
          key={label}
          variant="secondary"
          className="max-w-28 shrink-0 truncate text-[10px] font-normal"
        >
          {label}
        </Badge>
      ))}
    </div>
  );
}

/**
 * Compact labels cell with a fixed width. When chips overflow, hovering the
 * cell starts an infinite right-to-left “train”; leaving resets to the start.
 * Duration scales with strip width so speed stays constant across rows.
 */
export function WorkItemLabelsTrain({
  labels,
}: Readonly<{ labels: readonly string[] }>) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [stripWidthPx, setStripWidthPx] = useState(0);
  const [hovering, setHovering] = useState(false);
  const title = labels.join(', ');

  useEffect(() => {
    const viewport = viewportRef.current;
    const measure = measureRef.current;
    if (!viewport || !measure) {
      return;
    }

    const update = () => {
      // `max-w-*` alone shrink-wraps to content, so overflow never trips.
      // Compare the full chip strip to the fixed viewport width.
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
  }, [labels]);

  const trainDurationSec =
    stripWidthPx > 0 ? stripWidthPx / LABELS_TRAIN_PX_PER_SEC : 8;

  if (labels.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <div
      ref={viewportRef}
      className={cn('relative min-w-0 overflow-hidden', LABELS_VIEWPORT_CLASS)}
      title={title}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Off-flow measure strip (single copy) for overflow detection */}
      <div
        ref={measureRef}
        className="pointer-events-none absolute top-0 left-0 -z-10 opacity-0"
        aria-hidden
      >
        <LabelsChipStrip labels={labels} />
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
          <LabelsChipStrip labels={labels} />
          <LabelsChipStrip labels={labels} ariaHidden />
        </div>
      ) : (
        <LabelsChipStrip labels={labels} />
      )}
    </div>
  );
}
