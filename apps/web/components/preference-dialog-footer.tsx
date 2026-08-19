'use client';

import type { ReactNode } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import { DialogFooter } from '@repo/ui/components/ui/dialog';
import { cn } from '@repo/ui/lib/utils';

type PreferenceDialogFooterProps = {
  readonly onReset: () => void;
  /** When false, Reset is disabled (e.g. nothing stored to clear). */
  readonly canReset?: boolean;
  readonly onCancel: () => void;
  readonly onSave: () => void;
  readonly saveDisabled?: boolean;
  /** When true with `onSkip`, shows “Skip for now” instead of Cancel. */
  readonly allowSkip?: boolean;
  readonly onSkip?: () => void;
  readonly className?: string;
  readonly resetLabel?: ReactNode;
  readonly saveLabel?: ReactNode;
};

/**
 * Shared footer for preference dialogs: Reset (left) + Cancel/Skip + Save (right).
 */
export function PreferenceDialogFooter({
  onReset,
  canReset = true,
  onCancel,
  onSave,
  saveDisabled = false,
  allowSkip = false,
  onSkip,
  className,
  resetLabel = 'Reset',
  saveLabel = 'Save',
}: Readonly<PreferenceDialogFooterProps>) {
  return (
    <DialogFooter className={cn('gap-2 sm:justify-between', className)}>
      <Button
        type="button"
        variant="ghost"
        className="text-muted-foreground"
        disabled={!canReset}
        onClick={onReset}
      >
        {resetLabel}
      </Button>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {allowSkip && onSkip ? (
          <Button type="button" variant="ghost" onClick={onSkip}>
            Skip for now
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="button" onClick={onSave} disabled={saveDisabled}>
          {saveLabel}
        </Button>
      </div>
    </DialogFooter>
  );
}
