'use client';

import { useEffect, useMemo, useState } from 'react';
import type { IntegrationWire } from '@repo/types';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
} from '@repo/ui/components/ui/dialog';
import { ExternalLink } from '@repo/ui/lib/icons';
import {
  CONFIGURABLE_CATALOG_PROVIDERS,
  integrationExternalHref,
  isConfigurableCatalog,
  type WorkspaceIntegration,
} from '@/app/settings/_components/settings-integration-catalog';
import { IntegrationConfigForm } from '@/app/settings/_components/settings-integration-config-form';
import {
  createFormStateForNewModel,
  createFormStateFromRow,
  createFormStateFromRows,
  DEFAULT_GEMINI_MODEL,
  integrationDialogStatusLabel,
  saveIntegrationModel,
  type IntegrationSaveFeedback,
} from '@/app/settings/_components/settings-integration-detail-dialog.helpers';
import { IntegrationSaveButton } from '@/app/settings/_components/settings-integration-save-button';
import {
  IntegrationHighlightsList,
  IntegrationIdentity,
} from '@/app/settings/_components/settings-integration-identity';

type IntegrationDetailDialogProps = {
  readonly integration: WorkspaceIntegration | null;
  readonly configuredRows: IntegrationWire[];
  readonly open: boolean;
  /* eslint-disable no-unused-vars -- callback param name documents the value */
  readonly onOpenChange: (open: boolean) => void;
  readonly onSaved: () => void;
  /* eslint-enable no-unused-vars */
};

function IntegrationVisitWebsiteButton({ href }: Readonly<{ href: string }>) {
  return (
    <Button type="button" variant="outline" asChild>
      <a href={href} target="_blank" rel="noopener noreferrer">
        Visit website
        <ExternalLink className="size-4" data-icon="inline-end" />
      </a>
    </Button>
  );
}

function IntegrationPlannedActions() {
  return (
    <>
      <Button type="button" disabled>
        Connect
      </Button>
      <Button type="button" variant="outline" disabled>
        Configure
      </Button>
    </>
  );
}

export function IntegrationDetailDialog({
  integration,
  configuredRows,
  open,
  onOpenChange,
  onSaved,
}: Readonly<IntegrationDetailDialogProps>) {
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [modelId, setModelId] = useState<string>(DEFAULT_GEMINI_MODEL.value);
  const [displayLabel, setDisplayLabel] = useState<string>(
    DEFAULT_GEMINI_MODEL.label
  );
  const [apiKey, setApiKey] = useState('');
  const [isDefault, setIsDefault] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<IntegrationSaveFeedback>({
    success: null,
    error: null,
  });

  const activeRows = useMemo(
    () => configuredRows.filter((row) => row.status === 'active'),
    [configuredRows]
  );

  const selectedRow = useMemo(
    () => activeRows.find((row) => row.id === selectedRowId) ?? null,
    [activeRows, selectedRowId]
  );

  useEffect(() => {
    if (!open || !integration) {
      return;
    }

    const nextState = createFormStateFromRows(activeRows);
    setSelectedRowId(nextState.selectedRowId);
    setModelId(nextState.modelId);
    setDisplayLabel(nextState.displayLabel);
    setIsDefault(nextState.isDefault);
    setApiKey('');
    setFeedback({ success: null, error: null });
  }, [open, integration, activeRows]);

  if (!integration) {
    return null;
  }

  const externalHref = integrationExternalHref(integration.websiteUrl);
  const canConfigure = isConfigurableCatalog(integration.id);
  const dialogStatusLabel = integrationDialogStatusLabel(
    integration,
    activeRows
  );

  const resetFeedback = () => {
    setFeedback({ success: null, error: null });
  };

  const handleSelectRow = (row: IntegrationWire) => {
    const nextState = createFormStateFromRow(row);
    setSelectedRowId(nextState.selectedRowId);
    setModelId(nextState.modelId);
    setDisplayLabel(nextState.displayLabel);
    setIsDefault(nextState.isDefault);
    setApiKey('');
    resetFeedback();
  };

  const handleAddModel = () => {
    const nextState = createFormStateForNewModel(activeRows);
    setSelectedRowId(nextState.selectedRowId);
    setModelId(nextState.modelId);
    setDisplayLabel(nextState.displayLabel);
    setIsDefault(nextState.isDefault);
    setApiKey('');
    resetFeedback();
  };

  const handleSave = async () => {
    if (!canConfigure || !(integration.id in CONFIGURABLE_CATALOG_PROVIDERS)) {
      return;
    }

    setIsSaving(true);
    resetFeedback();

    const result = await saveIntegrationModel({
      catalogId: integration.id,
      selectedRow,
      modelId,
      displayLabel,
      apiKey,
      isDefault,
    });

    setFeedback(result);
    setIsSaving(false);

    if (result.success) {
      setApiKey('');
      onSaved();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="space-y-4 pr-8">
          <IntegrationIdentity
            name={integration.name}
            websiteUrl={integration.websiteUrl}
            variant="dialog"
            statusLabel={dialogStatusLabel}
          />
          <DialogDescription className="text-left text-sm leading-relaxed">
            {integration.description}
          </DialogDescription>
        </DialogHeader>

        {integration.highlights?.length ? (
          <IntegrationHighlightsList highlights={integration.highlights} />
        ) : null}

        {canConfigure ? (
          <IntegrationConfigForm
            activeRows={activeRows}
            selectedRowId={selectedRowId}
            selectedRow={selectedRow}
            displayLabel={displayLabel}
            modelId={modelId}
            apiKey={apiKey}
            isDefault={isDefault}
            feedback={feedback}
            onSelectRow={handleSelectRow}
            onAddModel={handleAddModel}
            onDisplayLabelChange={setDisplayLabel}
            onModelIdChange={setModelId}
            onApiKeyChange={setApiKey}
            onIsDefaultChange={setIsDefault}
          />
        ) : null}

        <DialogFooter className="gap-2 sm:justify-between">
          <IntegrationVisitWebsiteButton href={externalHref} />
          <div className="flex flex-wrap gap-2">
            {canConfigure ? (
              <IntegrationSaveButton
                isSaving={isSaving}
                isEditingExistingRow={Boolean(selectedRow)}
                onSave={() => void handleSave()}
              />
            ) : (
              <IntegrationPlannedActions />
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
