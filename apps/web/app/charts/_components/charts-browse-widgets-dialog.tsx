'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Input } from '@repo/ui/components/ui/input';
import { ScrollArea } from '@repo/ui/components/ui/scroll-area';
import { cn } from '@repo/ui/lib/utils';
import { Search } from '@repo/ui/lib/icons';
import {
  CHART_WIDGET_CATALOG,
  CHART_WIDGET_CATEGORIES,
  chartWidgetsForCategory,
  isChartWidgetAvailable,
  type ChartWidgetCategoryId,
  type ChartWidgetDefinition,
} from '@/app/charts/_components/charts-widget-catalog';
import type { ChartWidgetTypeId } from '@/app/charts/_components/charts.types';

type BrowseWidgetsDialogProps = {
  readonly open: boolean;
  // eslint-disable-next-line no-unused-vars -- dialog open change
  readonly onOpenChange: (open: boolean) => void;
  // eslint-disable-next-line no-unused-vars -- widget pick
  readonly onSelectWidget: (typeId: ChartWidgetTypeId) => void;
};

export function BrowseWidgetsDialog({
  open,
  onOpenChange,
  onSelectWidget,
}: Readonly<BrowseWidgetsDialogProps>) {
  const [categoryId, setCategoryId] =
    useState<ChartWidgetCategoryId>('staying-on-top');
  const [query, setQuery] = useState('');

  const categoryLabel =
    CHART_WIDGET_CATEGORIES.find((item) => item.id === categoryId)?.label ??
    'Widgets';

  const widgets = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    const base = trimmed
      ? CHART_WIDGET_CATALOG.filter(
          (item) =>
            item.title.toLowerCase().includes(trimmed) ||
            item.description.toLowerCase().includes(trimmed)
        )
      : chartWidgetsForCategory(categoryId);
    return base;
  }, [categoryId, query]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setQuery('');
        }
        onOpenChange(next);
      }}
    >
      <DialogContent
        showCloseButton
        className={cn(
          'flex flex-col gap-0 overflow-hidden p-0',
          // Override DialogContent defaults (`max-w-[calc(100%-2rem)]` / `sm:max-w-lg`).
          'h-[min(94vh,920px)] w-[min(96vw,1280px)] max-w-none sm:max-w-none'
        )}
      >
        <div className="border-border grid shrink-0 grid-cols-[auto_minmax(0,28rem)_auto] items-center gap-4 border-b px-5 py-3.5 pr-12">
          <DialogTitle className="text-base font-semibold tracking-tight whitespace-nowrap">
            Browse Widgets
          </DialogTitle>
          <DialogDescription className="sr-only">
            Browse widget categories and add widgets to your charts board.
          </DialogDescription>
          <div className="relative w-full justify-self-center">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              className="h-9 pl-9"
              aria-label="Search widgets"
            />
          </div>
          <span aria-hidden className="w-8" />
        </div>

        <div className="flex min-h-0 flex-1">
          <aside className="border-border bg-muted/20 flex w-56 shrink-0 flex-col border-r p-3">
            <p className="text-muted-foreground px-2 pb-2 text-xs font-medium tracking-wide uppercase">
              Categories
            </p>
            <nav className="space-y-0.5" aria-label="Widget categories">
              {CHART_WIDGET_CATEGORIES.map((category) => {
                const active = !query.trim() && category.id === categoryId;
                return (
                  <button
                    key={category.id}
                    type="button"
                    className={cn(
                      'hover:bg-accent/60 w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm transition-colors',
                      active && 'bg-primary/10 text-primary font-medium'
                    )}
                    onClick={() => {
                      setQuery('');
                      setCategoryId(category.id);
                    }}
                  >
                    {category.label}
                  </button>
                );
              })}
            </nav>
          </aside>

          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-6 p-6 lg:p-8">
              <div>
                <h3 className="text-lg font-semibold tracking-tight">
                  {query.trim() ? 'Search results' : categoryLabel}
                </h3>
                {widgets.length === 0 ? (
                  <p className="text-muted-foreground mt-4 text-sm">
                    No widgets match your search.
                  </p>
                ) : (
                  <ul className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {widgets.map((widget) => (
                      <li key={widget.id} className="min-w-0">
                        <WidgetCenterCard
                          widget={widget}
                          onAdd={() => onSelectWidget(widget.id)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WidgetCenterCard({
  widget,
  onAdd,
}: Readonly<{
  widget: ChartWidgetDefinition;
  onAdd: () => void;
}>) {
  const Icon = widget.icon;
  const available = isChartWidgetAvailable(widget.id);

  return (
    <article
      className={cn(
        'border-border bg-card flex h-full min-w-0 flex-col rounded-2xl border p-5 shadow-sm',
        !available && 'opacity-80'
      )}
    >
      <div className="bg-primary/10 text-primary mb-4 flex size-12 shrink-0 items-center justify-center rounded-xl">
        <Icon className="size-6" aria-hidden />
      </div>
      <div className="flex items-start gap-2">
        <h4 className="min-w-0 flex-1 text-sm font-semibold tracking-tight">
          {widget.title}
        </h4>
        {!available ? (
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            Coming soon
          </Badge>
        ) : null}
      </div>
      <p className="text-muted-foreground mt-1.5 min-h-10 flex-1 text-sm leading-relaxed">
        {widget.description}
      </p>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className={cn(
          'mt-5 w-full shrink-0',
          available ? 'cursor-pointer' : 'cursor-not-allowed'
        )}
        disabled={!available}
        onClick={onAdd}
      >
        {available ? 'Add widget' : 'Coming soon'}
      </Button>
    </article>
  );
}
