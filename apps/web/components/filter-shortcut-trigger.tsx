'use client';

import type { ReactNode } from 'react';
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
  readonly children?: ReactNode;
};

/** Shared Shift+F Filter outline button used by registry filter dialogs. */
export function FilterShortcutTrigger({
  open,
  hasActiveFilters,
  hideTooltipWhileOpen = false,
  delayDuration,
  children = 'Filter',
}: Readonly<FilterShortcutTriggerProps>) {
  return (
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip open={hideTooltipWhileOpen && open ? false : undefined}>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Open filters"
              aria-keyshortcuts="Shift+F"
              className={cn(
                'h-9 cursor-pointer gap-1.5 px-3',
                (open || hasActiveFilters) &&
                  'border-primary text-primary hover:text-primary'
              )}
            >
              <Filter className="size-3.5" />
              {children}
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
