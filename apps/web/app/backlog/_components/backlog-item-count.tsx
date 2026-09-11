'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';

type BacklogItemCountProps = {
  readonly count: number;
};

export function BacklogItemCount({ count }: Readonly<BacklogItemCountProps>) {
  const label = `${count} work item${count === 1 ? '' : 's'}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="text-muted-foreground bg-muted/65 inline-flex min-w-6 cursor-default items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums"
          aria-label={label}
        >
          {count}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
