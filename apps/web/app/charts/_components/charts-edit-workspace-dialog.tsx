'use client';

import { useEffect, useState } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import {
  ChartsDescriptionField,
  useChartsAliceDescriptionSuggest,
} from '@/app/charts/_components/charts-description-field';

export type ChartsEditWorkspacePayload = {
  readonly title: string;
  readonly description: string | null;
  readonly showOnDashboard: boolean;
  readonly dashboardSortOrder: number;
};

type ChartsEditWorkspaceDialogProps = {
  readonly open: boolean;
  // eslint-disable-next-line no-unused-vars
  readonly onOpenChange: (open: boolean) => void;
  readonly defaultTitle: string;
  readonly defaultDescription?: string | null;
  readonly initialShowOnDashboard?: boolean;
  readonly initialDashboardSortOrder?: number;
  readonly onSave: (
    // eslint-disable-next-line no-unused-vars
    payload: ChartsEditWorkspacePayload
  ) => void | Promise<void>;
};

export function ChartsEditWorkspaceDialog({
  open,
  onOpenChange,
  defaultTitle,
  defaultDescription = null,
  initialShowOnDashboard = false,
  initialDashboardSortOrder = 0,
  onSave,
}: Readonly<ChartsEditWorkspaceDialogProps>) {
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState(defaultDescription ?? '');
  const [showOnDashboard, setShowOnDashboard] = useState(
    initialShowOnDashboard
  );
  const [sortOrder, setSortOrder] = useState(String(initialDashboardSortOrder));
  const [pending, setPending] = useState(false);
  const { suggesting, suggestError, suggest, resetSuggestError } =
    useChartsAliceDescriptionSuggest({
      scope: 'workspace',
      title,
      description,
      onDescriptionChange: setDescription,
    });

  useEffect(() => {
    if (!open) {
      return;
    }
    setTitle(defaultTitle);
    setDescription(defaultDescription ?? '');
    setShowOnDashboard(initialShowOnDashboard);
    setSortOrder(String(initialDashboardSortOrder));
    setPending(false);
    resetSuggestError();
  }, [
    open,
    defaultTitle,
    defaultDescription,
    initialShowOnDashboard,
    initialDashboardSortOrder,
    resetSuggestError,
  ]);

  const parsedOrder = Number.parseInt(sortOrder, 10);
  const orderValid =
    Number.isFinite(parsedOrder) &&
    parsedOrder >= 0 &&
    parsedOrder <= 1_000_000;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending || suggesting) {
          return;
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit workspace</DialogTitle>
          <DialogDescription>
            Update name, description, and Dashboard Overview pin settings.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="chart-edit-title">Name</Label>
            <Input
              id="chart-edit-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Charts"
              autoFocus
              disabled={pending || suggesting}
            />
          </div>
          <ChartsDescriptionField
            id="chart-edit-description"
            value={description}
            onChange={setDescription}
            title={title}
            suggesting={suggesting}
            suggestError={suggestError}
            onSuggest={() => {
              suggest().catch(() => {});
            }}
            placeholder="What this workspace is for…"
            disabled={pending}
          />
          <div className="flex flex-col gap-2">
            <Label htmlFor="chart-edit-order">Dashboard order</Label>
            <Input
              id="chart-edit-order"
              type="number"
              min={0}
              max={1_000_000}
              step={1}
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
              disabled={pending || suggesting}
            />
            <p className="text-muted-foreground text-xs">
              Lower numbers appear earlier on the Overview slider.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={showOnDashboard}
              disabled={pending || suggesting}
              onCheckedChange={(checked) =>
                setShowOnDashboard(checked === true)
              }
            />
            Show on dashboard
          </label>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            disabled={pending || suggesting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="cursor-pointer"
            disabled={!title.trim() || !orderValid || pending || suggesting}
            onClick={() => {
              setPending(true);
              Promise.resolve(
                onSave({
                  title: title.trim(),
                  description: description.trim() || null,
                  showOnDashboard,
                  dashboardSortOrder: parsedOrder,
                })
              )
                .then(() => {
                  onOpenChange(false);
                })
                .catch(() => {
                  setPending(false);
                });
            }}
          >
            {pending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
