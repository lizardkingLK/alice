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

      <div className="flex gap-3 pt-2">
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            disabled={isBusy}
            onClick={onCancel}
            className="w-1/3"
          >
            Cancel
          </Button>
        ) : null}
        <Button
          type="submit"
          disabled={isBusy}
          className={onCancel ? 'w-2/3' : 'w-full'}
        >
          {submitLabel}
        </Button>
      </div>
    </>
  );
}
