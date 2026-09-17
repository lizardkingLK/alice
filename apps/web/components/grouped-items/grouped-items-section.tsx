'use client';

import { useState, type DragEvent, type ReactNode } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@repo/ui/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import { ChevronDown, ChevronRight, Plus } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';

type GroupedItemsSectionProps = {
  readonly label: ReactNode;
  readonly itemCount: number;
  readonly defaultOpen?: boolean;
  readonly labelClassName?: string;
  readonly addAriaLabel?: string;
  readonly onAdd?: () => void;
  readonly isDragOver?: boolean;
  // eslint-disable-next-line no-unused-vars -- drag handlers
  readonly onDragOver?: (event: DragEvent) => void;
  readonly onDragLeave?: () => void;
  // eslint-disable-next-line no-unused-vars -- drop handler
  readonly onDrop?: (event: DragEvent) => void;
  readonly children: ReactNode;
  readonly className?: string;
};

/**
 * Collapsible group shell used by Charts status tables and Board grouped layout.
 */
export function GroupedItemsSection({
  label,
  itemCount,
  defaultOpen = true,
  labelClassName,
  addAriaLabel,
  onAdd,
  isDragOver = false,
  onDragOver,
  onDragLeave,
  onDrop,
  children,
  className,
}: Readonly<GroupedItemsSectionProps>) {
  const [open, setOpen] = useState(defaultOpen);
  const countLabel = itemCount === 1 ? '1 item' : `${itemCount} items`;

  return (
    <div
      className={cn(
        'min-w-0 rounded-lg transition-colors',
        isDragOver && 'border-primary/30 bg-primary/5 border-2 border-dashed',
        className
      )}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center gap-1">
          <CollapsibleTrigger
            type="button"
            aria-label={`${typeof label === 'string' ? label : 'Group'}, ${countLabel}`}
            className={cn(
              'group hover:bg-muted/50 flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 text-left text-sm font-semibold tracking-tight',
              labelClassName
            )}
          >
            {open ? (
              <ChevronDown className="size-4 shrink-0" aria-hidden />
            ) : (
              <ChevronRight className="size-4 shrink-0" aria-hidden />
            )}
            <span className="flex min-w-0 items-baseline gap-1.5">
              <span className="min-w-0">{label}</span>
              <span
                className="text-muted-foreground text-xs font-normal opacity-0 transition-opacity group-hover:opacity-100"
                aria-hidden
              >
                {countLabel}
              </span>
            </span>
          </CollapsibleTrigger>

          {onAdd && addAriaLabel ? (
            <Tooltip delayDuration={400}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={addAriaLabel}
                  className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                  onClick={(event) => {
                    event.stopPropagation();
                    onAdd();
                  }}
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  <Plus className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Add task</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
        <CollapsibleContent className="pt-1 pb-3">
          {children}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
