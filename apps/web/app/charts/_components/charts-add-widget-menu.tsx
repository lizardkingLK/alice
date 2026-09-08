'use client';

import { useState } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import { Plus } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { BrowseWidgetsDialog } from '@/app/charts/_components/charts-browse-widgets-dialog';
import {
  CHART_QUICK_ADD_WIDGETS,
  type ChartWidgetDefinition,
} from '@/app/charts/_components/charts-widget-catalog';
import type { ChartWidgetTypeId } from '@/app/charts/_components/charts.types';

type ChartsAddWidgetMenuProps = {
  // eslint-disable-next-line no-unused-vars -- widget pick callback
  readonly onSelectWidget: (typeId: ChartWidgetTypeId) => void;
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
  return (
    <DropdownMenuItem
      className="cursor-pointer items-start gap-3 rounded-lg px-2.5 py-2.5"
      onSelect={onSelect}
    >
      <span className="bg-primary/10 text-primary mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg">
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 space-y-0.5">
        <span className="block text-sm font-semibold">{item.title}</span>
        <span className="text-muted-foreground block text-xs leading-snug whitespace-normal">
          {item.description}
        </span>
      </span>
    </DropdownMenuItem>
  );
}

export function ChartsAddWidgetMenu({
  onSelectWidget,
  className,
}: Readonly<ChartsAddWidgetMenuProps>) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [centerOpen, setCenterOpen] = useState(false);

  const quickPrimary = CHART_QUICK_ADD_WIDGETS.filter(
    (item) => item.id !== 'apps'
  );
  const appsItem = CHART_QUICK_ADD_WIDGETS.find((item) => item.id === 'apps');

  const handleSelect = (typeId: ChartWidgetTypeId) => {
    onSelectWidget(typeId);
    setMenuOpen(false);
    setCenterOpen(false);
  };

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            className={cn('shrink-0 cursor-pointer', className)}
          >
            <Plus />
            Add Widget
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80 p-1.5">
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
              setCenterOpen(true);
            }}
          >
            More widgets
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <BrowseWidgetsDialog
        open={centerOpen}
        onOpenChange={setCenterOpen}
        onSelectWidget={handleSelect}
      />
    </>
  );
}
