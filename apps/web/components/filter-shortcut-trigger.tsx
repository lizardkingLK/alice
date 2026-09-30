'use client';

import { Button } from '@repo/ui/components/ui/button';
import { DialogTrigger } from '@repo/ui/components/ui/dialog';
import { Filter } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';

type FilterShortcutTriggerProps = {
  readonly open: boolean;
  readonly hasActiveFilters: boolean;
};

/** Shared Shift+F Filter icon button used by registry filter dialogs. */
export function FilterShortcutTrigger({
  open,
  hasActiveFilters,
}: Readonly<FilterShortcutTriggerProps>) {
  return (
    <DialogTrigger asChild>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Open filters"
        aria-keyshortcuts="Shift+F"
        title="Press Shift + F to open and close"
        className={cn(
          'size-9 shrink-0 cursor-pointer',
          (open || hasActiveFilters) &&
            'border-primary text-primary hover:text-primary'
        )}
      >
        <Filter className="size-4" />
      </Button>
    </DialogTrigger>
  );
}
