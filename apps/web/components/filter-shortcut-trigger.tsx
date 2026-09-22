'use client';

import { Button } from '@repo/ui/components/ui/button';
import { DialogTrigger } from '@repo/ui/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import { Filter } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';

type FilterShortcutTriggerProps = {
  readonly open: boolean;
  readonly hasActiveFilters: boolean;
  /** When set, tooltip stays closed while the dialog is open. */
  readonly hideTooltipWhileOpen?: boolean;
  readonly delayDuration?: number;
};

/** Shared Shift+F Filter icon button used by registry filter dialogs. */
export function FilterShortcutTrigger({
  open,
  hasActiveFilters,
  hideTooltipWhileOpen = false,
  delayDuration,
}: Readonly<FilterShortcutTriggerProps>) {
  return (
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip open={hideTooltipWhileOpen && open ? false : undefined}>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Open filters"
              aria-keyshortcuts="Shift+F"
              className={cn(
                'size-9 shrink-0 cursor-pointer',
                (open || hasActiveFilters) &&
                  'border-primary text-primary hover:text-primary'
              )}
            >
              <Filter className="size-4" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Press Shift + F to open and close
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
