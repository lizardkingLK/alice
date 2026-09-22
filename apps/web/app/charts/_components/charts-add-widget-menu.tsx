'use client';

import { useState } from 'react';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import { BarChart3, LayoutDashboard, Plus } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { BrowseWidgetsDialog } from '@/app/charts/_components/charts-browse-widgets-dialog';
import {
  CHART_QUICK_ADD_WIDGETS,
  isChartWidgetAvailable,
  type ChartWidgetDefinition,
} from '@/app/charts/_components/charts-widget-catalog';
import type { ChartWidgetTypeId } from '@/app/charts/_components/charts.types';

type ChartsAddMenuProps = {
  // eslint-disable-next-line no-unused-vars -- widget pick callback
  readonly onSelectWidget: (typeId: ChartWidgetTypeId) => void;
  readonly onAddWorkspace: () => void;
  readonly className?: string;
};

function QuickAddMenuItem({
  item,
  onSelect,
}: Readonly<{
  item: ChartWidgetDefinition;
  onSelect: () => void;
}>) {
  const Icon = item.icon;
  const available = isChartWidgetAvailable(item.id);

  return (
    <DropdownMenuItem
      className={cn(
        'items-start gap-3 rounded-lg px-2.5 py-2.5',
        available ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'
      )}
      disabled={!available}
      onSelect={(event) => {
        if (!available) {
          event.preventDefault();
          return;
        }
        onSelect();
      }}
    >
      <span className="bg-primary/10 text-primary mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg">
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="flex items-center gap-2">
          <span className="block text-sm font-semibold">{item.title}</span>
          {!available ? (
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              Coming soon
            </Badge>
          ) : null}
        </span>
        <span className="text-muted-foreground block text-xs leading-snug whitespace-normal">
          {item.description}
        </span>
      </span>
    </DropdownMenuItem>
  );
}

/** Plus menu: add workspace or add widget (Backlog-style). */
export function ChartsAddMenu({
  onSelectWidget,
  onAddWorkspace,
  className,
}: Readonly<ChartsAddMenuProps>) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);

  const quickPrimary = CHART_QUICK_ADD_WIDGETS.filter(
    (item) => item.id !== 'apps'
  );
  const appsItem = CHART_QUICK_ADD_WIDGETS.find((item) => item.id === 'apps');

  const handleSelect = (typeId: ChartWidgetTypeId) => {
    if (!isChartWidgetAvailable(typeId)) {
      return;
    }
    onSelectWidget(typeId);
    setMenuOpen(false);
    setBrowseOpen(false);
  };

  return (
    <>
      <TooltipProvider delayDuration={200}>
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  className={cn('size-8 shrink-0 cursor-pointer', className)}
                  aria-label="Add"
                >
                  <Plus className="size-4" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">Add</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-56 p-1.5">
            <DropdownMenuItem
              className="cursor-pointer gap-2"
              onSelect={() => {
                onAddWorkspace();
                setMenuOpen(false);
              }}
            >
              <LayoutDashboard className="size-4" />
              Add workspace
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1.5" />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="cursor-pointer gap-2">
                <BarChart3 className="size-4" />
                Add widget
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-80 p-1.5">
                {quickPrimary.map((item) => (
                  <QuickAddMenuItem
                    key={item.id}
                    item={item}
                    onSelect={() => handleSelect(item.id)}
                  />
                ))}
                {appsItem ? (
                  <>
                    <DropdownMenuSeparator className="my-1.5" />
                    <QuickAddMenuItem
                      item={appsItem}
                      onSelect={() => handleSelect(appsItem.id)}
                    />
                  </>
                ) : null}
                <DropdownMenuSeparator className="my-1.5" />
                <DropdownMenuItem
                  className="text-muted-foreground hover:text-foreground cursor-pointer justify-center rounded-lg py-2.5 text-sm font-medium"
                  onSelect={(event) => {
                    event.preventDefault();
                    setMenuOpen(false);
                    setBrowseOpen(true);
                  }}
                >
                  More widgets
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      </TooltipProvider>

      <BrowseWidgetsDialog
        open={browseOpen}
        onOpenChange={setBrowseOpen}
        onSelectWidget={handleSelect}
      />
    </>
  );
}

/** @deprecated Prefer {@link ChartsAddMenu}. */
export const ChartsAddWidgetMenu = ChartsAddMenu;
