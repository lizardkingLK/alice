'use client';

import { Badge } from '@repo/ui/components/ui/badge';
import { HoverChipTrain } from '@/components/hover-chip-train';

/** Fixed labels cell width (Tailwind `w-36` = 9rem). */
const LABELS_VIEWPORT_CLASS = 'w-36';

function LabelsChipStrip({
  labels,
}: Readonly<{
  labels: readonly string[];
}>) {
  return (
    <div className="flex shrink-0 items-center gap-1 pr-1">
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
 */
export function WorkItemLabelsTrain({
  labels,
}: Readonly<{ labels: readonly string[] }>) {
  if (labels.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <HoverChipTrain
      className={LABELS_VIEWPORT_CLASS}
      contentKey={labels.join('\0')}
      title={labels.join(', ')}
    >
      <LabelsChipStrip labels={labels} />
    </HoverChipTrain>
  );
}
