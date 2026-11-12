'use client';

import { Button } from '@repo/ui/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import { ChevronLeft, ChevronRight } from '@repo/ui/lib/icons';

type ChatAgentChevronSwitcherProps = {
  readonly disabled?: boolean;
  // eslint-disable-next-line no-unused-vars -- direction callback
  readonly onShift: (direction: -1 | 1) => void;
};

/** Compact prev/next controls for cycling chat agent personalities. */
export function ChatAgentChevronSwitcher({
  disabled = false,
  onShift,
}: Readonly<ChatAgentChevronSwitcherProps>) {
  return (
    <div className="flex items-center">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="cursor-pointer"
            aria-label="Previous agent"
            disabled={disabled}
            onClick={() => onShift(-1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Previous agent</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="cursor-pointer"
            aria-label="Next agent"
            disabled={disabled}
            onClick={() => onShift(1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Next agent</TooltipContent>
      </Tooltip>
    </div>
  );
}
