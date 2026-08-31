'use client';

import { Button } from '@repo/ui/components/ui/button';
import { Loader2 } from '@repo/ui/lib/icons';
import { integrationSaveButtonLabel } from '@/app/settings/_components/settings-integration-detail-dialog.helpers';

type IntegrationSaveButtonProps = {
  readonly isSaving: boolean;
  readonly isEditingExistingRow: boolean;
  readonly onSave: () => void;
};

export function IntegrationSaveButton({
  isSaving,
  isEditingExistingRow,
  onSave,
}: Readonly<IntegrationSaveButtonProps>) {
  const label = integrationSaveButtonLabel(isSaving, isEditingExistingRow);

  return (
    <Button type="button" onClick={onSave} disabled={isSaving}>
      {isSaving ? (
        <>
          <Loader2 className="animate-spin" data-icon="inline-start" />
          {label}
        </>
      ) : (
        label
      )}
    </Button>
  );
}
