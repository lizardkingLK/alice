'use client';

import { useEffect, useState } from 'react';
import type { VisibilityState } from '@tanstack/react-table';
import { Button } from '@repo/ui/components/ui/button';
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
import { ColumnOptionRow } from '@/components/table-columns/column-option-row';
import { PreferenceDialogFooter } from '@/components/preference-dialog-footer';
import { PREFERENCE_APPLIED_OUTLINE_BUTTON_CLASS } from '@/lib/preference-applied-ui';

export type TableColumnsDialogProps = {
  readonly visibility: VisibilityState;
  readonly columnIds: readonly string[];
  readonly labels: Record<string, string>;
  readonly defaultVisibility: VisibilityState;
  readonly inputIdPrefix: string;
  readonly disabled?: boolean;
  readonly title?: string;
  readonly description?: string;
  readonly contentClassName?: string;
  readonly listClassName?: string;
  readonly triggerClassName?: string;
  // eslint-disable-next-line no-unused-vars
  readonly triggerAriaLabel?: string | ((applied: boolean) => string);
  readonly highlightTriggerWhenOpen?: boolean;
  // eslint-disable-next-line no-unused-vars
  readonly normalize: (value: VisibilityState) => VisibilityState;
  // eslint-disable-next-line no-unused-vars
  readonly hasCustom: (visibility: VisibilityState) => boolean;
  // eslint-disable-next-line no-unused-vars
  readonly isRequired: (id: string) => boolean;
  // eslint-disable-next-line no-unused-vars
  readonly onApply: (visibility: VisibilityState) => void;
  readonly blockOpenWhenDisabled?: boolean;
};

export function TableColumnsDialog({
  visibility,
  columnIds,
  labels,
  defaultVisibility,
  inputIdPrefix,
  disabled = false,
  title = 'Columns',
  description = 'Choose which columns appear in the table.',
  contentClassName = 'sm:max-w-sm',
  listClassName = 'mt-2 flex flex-col gap-0.5',
  triggerClassName = 'h-9 cursor-pointer gap-1.5 px-3 text-xs',
  triggerAriaLabel,
  highlightTriggerWhenOpen = false,
  normalize,
  hasCustom,
  isRequired,
  onApply,
  blockOpenWhenDisabled = false,
}: Readonly<TableColumnsDialogProps>) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => normalize(visibility));
  const applied = hasCustom(visibility);
  const resolvedTriggerAriaLabel =
    typeof triggerAriaLabel === 'function'
      ? triggerAriaLabel(applied)
      : triggerAriaLabel;

  useEffect(() => {
    if (!open) {
      return;
    }
    setDraft(normalize(visibility));
  }, [normalize, open, visibility]);

  const setColumnChecked = (id: string, checked: boolean) => {
    if (isRequired(id)) {
      return;
    }
    setDraft((current) =>
      normalize({
        ...current,
        [id]: checked,
      })
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (blockOpenWhenDisabled && disabled) {
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
          className={cn(
            triggerClassName,
            (applied || (highlightTriggerWhenOpen && open)) &&
              PREFERENCE_APPLIED_OUTLINE_BUTTON_CLASS
          )}
          disabled={disabled}
          aria-label={resolvedTriggerAriaLabel}
        >
          <Columns3 className="size-3.5" />
          Columns
        </Button>
      </DialogTrigger>
      <DialogContent className={contentClassName}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className={listClassName}>
          {columnIds.map((id) => (
            <ColumnOptionRow
              key={id}
              id={id}
              label={labels[id] ?? id}
              checked={draft[id] !== false}
              disabled={isRequired(id)}
              inputIdPrefix={inputIdPrefix}
              onCheckedChange={(checked) => setColumnChecked(id, checked)}
            />
          ))}
        </div>
        <PreferenceDialogFooter
          onReset={() => setDraft(normalize(defaultVisibility))}
          onCancel={() => setOpen(false)}
          onSave={() => {
            onApply(normalize(draft));
            setOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
