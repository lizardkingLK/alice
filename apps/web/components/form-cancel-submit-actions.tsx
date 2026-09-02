'use client';

import type { ReactNode } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import { FormAlertMessage } from '@/components/form-alert-message';

interface FormCancelSubmitActionsProps {
  readonly message: string | null;
  readonly isError: boolean;
  /** True while submitting or after a success lock (disables Cancel + Submit). */
  readonly isBusy: boolean;
  readonly onCancel?: () => void;
  readonly submitLabel: ReactNode;
}

/**
 * Shared alert + Cancel/Submit footer used by registry create/edit forms.
 */
export function FormCancelSubmitActions({
  message,
  isError,
  isBusy,
  onCancel,
  submitLabel,
}: Readonly<FormCancelSubmitActionsProps>) {
  return (
    <>
      <FormAlertMessage message={message} isError={isError} />

      <div className="flex items-center justify-end gap-3 pt-2">
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            disabled={isBusy}
            onClick={onCancel}
            className="min-w-24 rounded-lg"
          >
            Cancel
          </Button>
        ) : null}
        <Button
          type="submit"
          disabled={isBusy}
          className="min-w-32 rounded-lg"
        >
          {submitLabel}
        </Button>
      </div>
    </>
  );
}
