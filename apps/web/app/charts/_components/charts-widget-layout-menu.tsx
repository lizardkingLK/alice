'use client';

import { Button } from '@repo/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import { ChartPie, Columns2, Table2 } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import type { ChartWidgetViewMode } from '@/app/charts/_components/charts.types';

const LAYOUT_OPTIONS: readonly {
  readonly id: ChartWidgetViewMode;
  readonly label: string;
  readonly description: string;
  readonly Icon: typeof ChartPie;
}[] = [
  {
    id: 'chart',
    label: 'Chart',
    description: 'Full chart view',
    Icon: ChartPie,
  },
  {
    id: 'table',
    label: 'Table',
    description: 'Status-grouped work items',
    Icon: Table2,
  },
  {
    id: 'split',
    label: 'Split mode',
    description: 'Chart above, table below',
    Icon: Columns2,
  },
] as const;

type ChartsWidgetLayoutMenuProps = {
  readonly viewMode: ChartWidgetViewMode;
  // eslint-disable-next-line no-unused-vars -- layout change callback
  readonly onViewModeChange: (mode: ChartWidgetViewMode) => void;
  readonly className?: string;
};

/** Fullscreen-only layout control — trigger always shows the split (Columns2) icon. */
export function ChartsWidgetLayoutMenu({
  viewMode,
  onViewModeChange,
  className,
}: Readonly<ChartsWidgetLayoutMenuProps>) {
  return (
    <DropdownMenu>
      <Tooltip delayDuration={400}>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Split view"
              className={cn(
                'text-muted-foreground hover:text-foreground shrink-0 cursor-pointer',
                viewMode !== 'chart' && 'text-primary hover:text-primary',
                className
              )}
            >
              <Columns2 className="size-4" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Split view</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Layout</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={viewMode}
          onValueChange={(value) => {
            onViewModeChange(value as ChartWidgetViewMode);
          }}
        >
          {LAYOUT_OPTIONS.map((option) => {
            const Icon = option.Icon;
            return (
              <DropdownMenuRadioItem
                key={option.id}
                value={option.id}
                className="cursor-pointer gap-2"
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="leading-none font-medium">
                    {option.label}
                  </span>
                  <span className="text-muted-foreground text-xs font-normal">
                    {option.description}
                  </span>
                </span>
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
