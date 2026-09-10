'use client';

import type { FormEvent, ReactNode } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import { Loader2 } from '@repo/ui/lib/icons';

export function IntegrationFeedbackBanner({
  message,
  isError,
}: Readonly<{ message: string | null; isError: boolean }>) {
  if (!message) {
    return null;
  }
  return (
    <div
      className={`rounded p-3 text-sm ${
        isError
          ? 'bg-destructive/10 text-destructive'
          : 'bg-emerald-500/10 text-emerald-600'
      }`}
    >
      {message}
    </div>
  );
}

export type IntegrationSummaryField = {
  readonly label: string;
  readonly value: string;
  readonly mono?: boolean;
};

export function IntegrationSummaryFields({
  fields,
}: Readonly<{ fields: readonly IntegrationSummaryField[] }>) {
  return (
    <div className="bg-muted/20 border-border/40 grid gap-4 rounded-lg border p-4 text-sm sm:grid-cols-2">
      {fields.map((field) => (
        <div key={field.label}>
          <span className="text-muted-foreground block text-xs font-semibold tracking-wider uppercase">
            {field.label}
          </span>
          <span
            className={
              field.mono
                ? 'text-foreground font-mono font-medium'
                : 'text-foreground font-medium'
            }
          >
            {field.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function IntegrationEditFormActions({
  showCancel,
  onCancel,
  isSaving,
  saveDisabled,
  saveLabel,
}: Readonly<{
  showCancel: boolean;
  onCancel: () => void;
  isSaving: boolean;
  saveDisabled?: boolean;
  saveLabel: string;
}>) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      {showCancel ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={isSaving}
        >
          Cancel
        </Button>
      ) : null}
      <Button type="submit" size="sm" disabled={isSaving || saveDisabled}>
        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {saveLabel}
      </Button>
    </div>
  );
}

export function IntegrationEditForm({
  onSubmit,
  children,
  showCancel,
  onCancel,
  isSaving,
  saveDisabled,
  saveLabel,
}: Readonly<{
  // eslint-disable-next-line no-unused-vars -- form submit
  onSubmit: (e: FormEvent) => void;
  children: ReactNode;
  showCancel: boolean;
  onCancel: () => void;
  isSaving: boolean;
  saveDisabled?: boolean;
  saveLabel: string;
}>) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {children}
      <IntegrationEditFormActions
        showCancel={showCancel}
        onCancel={onCancel}
        isSaving={isSaving}
        saveDisabled={saveDisabled}
        saveLabel={saveLabel}
      />
    </form>
  );
}
