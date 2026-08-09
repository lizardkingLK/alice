'use client';

import { useEffect, useState } from 'react';
import type { VisibilityState } from '@tanstack/react-table';
import { Button } from '@repo/ui/components/ui/button';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@repo/ui/components/ui/dialog';
import { Columns3 } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { PreferenceDialogFooter } from '@/components/preference-dialog-footer';
import { PREFERENCE_APPLIED_OUTLINE_BUTTON_CLASS } from '@/lib/preference-applied-ui';
import {
  DEFAULT_WORK_ITEM_TABLE_COLUMN_VISIBILITY,
  WORK_ITEM_TABLE_COLUMN_LABELS,
  hasCustomWorkItemTableColumnVisibility,
  isRequiredWorkItemTableColumnId,
  listWorkItemTableColumnOptions,
  normalizeWorkItemTableColumnVisibility,
  type WorkItemTableColumnId,
} from '@/app/work-items/_helpers/work-item-table-columns-storage';

function ColumnOptionRow({
  id,
  checked,
  disabled,
  onCheckedChange,
}: Readonly<{
  id: WorkItemTableColumnId;
  checked: boolean;
  disabled: boolean;
  // eslint-disable-next-line no-unused-vars
  onCheckedChange: (checked: boolean) => void;
}>) {
  const inputId = `work-item-column-${id}`;
  return (
    <div
      className={cn(
        'hover:bg-muted/50 flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm',
        disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
      )}
    >
      <Checkbox
        id={inputId}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="cursor-pointer"
      />
      <label
        htmlFor={inputId}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2',
          disabled ? 'cursor-not-allowed' : 'cursor-pointer'
        )}
      >
        <span className="min-w-0 flex-1">
          {WORK_ITEM_TABLE_COLUMN_LABELS[id]}
        </span>
        {disabled ? (
          <span className="text-muted-foreground text-xs">Required</span>
        ) : null}
      </label>
    </div>
  );
}

export function WorkItemsColumnsDialog({
  visibility,
  isProjectLocked,
  disabled = false,
  onApply,
}: Readonly<{
  visibility: VisibilityState;
  isProjectLocked: boolean;
  disabled?: boolean;
  // eslint-disable-next-line no-unused-vars
  onApply: (visibility: VisibilityState) => void;
}>) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<VisibilityState>(() =>
    normalizeWorkItemTableColumnVisibility(visibility)
  );

  const columnIds = listWorkItemTableColumnOptions({ isProjectLocked });
  const columnsApplied = hasCustomWorkItemTableColumnVisibility(visibility, {
    isProjectLocked,
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    setDraft(normalizeWorkItemTableColumnVisibility(visibility));
  }, [open, visibility]);

  const setColumnChecked = (id: WorkItemTableColumnId, checked: boolean) => {
    if (isRequiredWorkItemTableColumnId(id)) {
      return;
    }
    setDraft((current) =>
      normalizeWorkItemTableColumnVisibility({
        ...current,
        [id]: checked,
      })
    );
  };

  const handleReset = () => {
    setDraft(
      normalizeWorkItemTableColumnVisibility(
        DEFAULT_WORK_ITEM_TABLE_COLUMN_VISIBILITY
      )
    );
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleOkay = () => {
    onApply(normalizeWorkItemTableColumnVisibility(draft));
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (disabled) {
          return;
        }
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={
            columnsApplied
              ? 'Columns applied — customize columns'
              : 'Customize columns'
          }
          disabled={disabled}
          className={cn(
            'h-9 cursor-pointer gap-1.5 px-3',
            (open || columnsApplied) && PREFERENCE_APPLIED_OUTLINE_BUTTON_CLASS
          )}
        >
          <Columns3 className="size-3.5" />
          Columns
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Customize columns</DialogTitle>
          <DialogDescription>
            Choose which columns appear on the work items table.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-86 space-y-0.5 overflow-y-auto py-1">
          {columnIds.map((id) => (
            <ColumnOptionRow
              key={id}
              id={id}
              checked={draft[id] !== false}
              disabled={isRequiredWorkItemTableColumnId(id)}
              onCheckedChange={(checked) => setColumnChecked(id, checked)}
            />
          ))}
        </div>

        <PreferenceDialogFooter
          onReset={handleReset}
          onCancel={handleClose}
          onSave={handleOkay}
        />
      </DialogContent>
    </Dialog>
  );
}
