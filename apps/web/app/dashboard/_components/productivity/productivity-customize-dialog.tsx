'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Label } from '@repo/ui/components/ui/label';
import { Switch } from '@repo/ui/components/ui/switch';
import { ExternalLink } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { afterDialogClose } from '@/lib/dialog-close';
import {
  PRODUCTIVITY_WIDGET_IDS,
  PRODUCTIVITY_WIDGET_LABELS,
  type OverviewMode,
  type ProductivityDashboardPreferences,
  type ProductivityWidgetId,
} from '@/app/dashboard/_helpers/productivity-dashboard-preferences';

type ProductivityCustomizeDialogProps = {
  readonly open: boolean;
  // eslint-disable-next-line no-unused-vars -- open-change callback
  readonly onOpenChange: (open: boolean) => void;
  readonly value: ProductivityDashboardPreferences;
  // eslint-disable-next-line no-unused-vars -- prefs change callback
  readonly onChange: (next: ProductivityDashboardPreferences) => void;
  /** Active chart board customize link when charts mode / slides exist. */
  readonly chartsCustomizeHref: string | null;
  readonly hasChartSlides: boolean;
};

export function ProductivityCustomizeDialog({
  open,
  onOpenChange,
  value,
  onChange,
  chartsCustomizeHref,
  hasChartSlides,
}: Readonly<ProductivityCustomizeDialogProps>) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (open) {
      setDraft(value);
    }
  }, [open, value]);

  useEffect(() => {
    if (open) {
      return;
    }
    return afterDialogClose(() => {
      setDraft(value);
    });
  }, [open, value]);

  const setMode = (mode: OverviewMode) => {
    setDraft((previous) => ({ ...previous, mode }));
  };

  const setWidget = (id: ProductivityWidgetId, enabled: boolean) => {
    setDraft((previous) => ({
      ...previous,
      widgets: { ...previous.widgets, [id]: enabled },
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,40rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-border shrink-0 space-y-1.5 border-b px-6 py-4 text-left">
          <DialogTitle>Customize Overview</DialogTitle>
          <DialogDescription>
            Switch between chart workspaces and the productivity dashboard.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-4">
          <section className="space-y-3">
            <p className="text-sm font-medium">Overview mode</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <ModeCard
                title="Chart workspaces"
                description={
                  hasChartSlides
                    ? 'Pinned boards on the Overview slider'
                    : 'Shows how to pin boards when none are on Overview yet'
                }
                selected={draft.mode === 'charts'}
                onSelect={() => setMode('charts')}
              />
              <ModeCard
                title="Productivity"
                description="My Work numbers, projects, Alice, docs, and focus"
                selected={draft.mode === 'productivity'}
                onSelect={() => setMode('productivity')}
              />
            </div>
            {draft.mode === 'charts' && chartsCustomizeHref ? (
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href={chartsCustomizeHref}>
                  Customize active board
                  <ExternalLink className="size-3.5" />
                </Link>
              </Button>
            ) : null}
            {draft.mode === 'charts' && !hasChartSlides ? (
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href="/charts">
                  Open Charts
                  <ExternalLink className="size-3.5" />
                </Link>
              </Button>
            ) : null}
          </section>

          <section className="space-y-3">
            <p className="text-sm font-medium">Productivity widgets</p>
            <p className="text-muted-foreground text-xs">
              Shown when Overview mode is Productivity.
            </p>
            <ul className="space-y-3">
              {PRODUCTIVITY_WIDGET_IDS.map((id) => (
                <li
                  key={id}
                  className="flex items-center justify-between gap-3"
                >
                  <Label
                    htmlFor={`productivity-widget-${id}`}
                    className="text-sm"
                  >
                    {PRODUCTIVITY_WIDGET_LABELS[id]}
                  </Label>
                  <Switch
                    id={`productivity-widget-${id}`}
                    checked={draft.widgets[id]}
                    onCheckedChange={(checked) =>
                      setWidget(id, checked === true)
                    }
                  />
                </li>
              ))}
            </ul>
          </section>
        </div>

        <DialogFooter className="bg-muted/50 m-0 shrink-0 gap-2 rounded-b-xl border-t px-6 py-4 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="cursor-pointer"
            onClick={() => {
              onChange(draft);
              onOpenChange(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModeCard({
  title,
  description,
  selected,
  onSelect,
}: Readonly<{
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}>) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'border-border flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors',
        selected
          ? 'border-primary bg-primary/5 ring-primary/30 ring-2'
          : 'hover:bg-muted/50'
      )}
    >
      <span className="text-sm font-medium">{title}</span>
      <span className="text-muted-foreground text-xs leading-relaxed">
        {description}
      </span>
    </button>
  );
}
