'use client';

import { useEffect, useMemo, useState } from 'react';
import { CHAT_MODELS, type IntegrationWire } from '@repo/types';
import { Button } from '@repo/ui/components/ui/button';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
} from '@repo/ui/components/ui/dialog';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { ExternalLink } from '@repo/ui/lib/icons';
import {
  CONFIGURABLE_CATALOG_PROVIDERS,
  integrationExternalHref,
  integrationStatusLabel,
  isConfigurableCatalog,
  type WorkspaceIntegration,
} from '@/app/settings/_components/settings-integration-catalog';
import {
  IntegrationHighlightsList,
  IntegrationIdentity,
} from '@/app/settings/_components/settings-integration-identity';
import {
  createWorkspaceIntegration,
  patchWorkspaceIntegration,
} from '@/app/settings/_services/integrations.mutations.client';
import { FormStatusAlerts } from '@/app/work-items/_components/work-item-form/work-item-form-alerts';
import { errorMessage } from '@/lib/errors/error-message';

const DEFAULT_GEMINI_MODEL = CHAT_MODELS.GEMINI_3_6_FLASH;

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
  const [feedback, setFeedback] = useState<{
    success: string | null;
    error: string | null;
  }>({ success: null, error: null });

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

    const defaultRow =
      activeRows.find((row) => row.is_default) ?? activeRows[0] ?? null;

    setSelectedRowId(defaultRow?.id ?? null);
    setModelId(
      defaultRow?.config.kind === 'chat_model'
        ? defaultRow.config.model
        : DEFAULT_GEMINI_MODEL.value
    );
    setDisplayLabel(
      defaultRow?.config.kind === 'chat_model'
        ? defaultRow.config.display_label
        : DEFAULT_GEMINI_MODEL.label
    );
    setIsDefault(defaultRow?.is_default ?? activeRows.length === 0);
    setApiKey('');
    setFeedback({ success: null, error: null });
  }, [open, integration, activeRows]);

  if (!integration) {
    return null;
  }

  const externalHref = integrationExternalHref(integration.websiteUrl);
  const canConfigure = isConfigurableCatalog(integration.id);

  const handleSelectRow = (row: IntegrationWire) => {
    setSelectedRowId(row.id);
    if (row.config.kind === 'chat_model') {
      setModelId(row.config.model);
      setDisplayLabel(row.config.display_label);
      setIsDefault(row.is_default);
    }
    setApiKey('');
    setFeedback({ success: null, error: null });
  };

  const handleAddModel = () => {
    setSelectedRowId(null);
    setModelId(DEFAULT_GEMINI_MODEL.value);
    setDisplayLabel(DEFAULT_GEMINI_MODEL.label);
    setIsDefault(activeRows.length === 0);
    setApiKey('');
    setFeedback({ success: null, error: null });
  };

  const handleSave = async () => {
    if (!canConfigure) {
      return;
    }

    const trimmedApiKey = apiKey.trim();
    const trimmedModel = modelId.trim();
    const trimmedLabel = displayLabel.trim();

    if (!trimmedModel || !trimmedLabel) {
      setFeedback({
        success: null,
        error: 'Model id and display label are required.',
      });
      return;
    }

    if (!selectedRow && !trimmedApiKey) {
      setFeedback({
        success: null,
        error: 'API key is required when connecting a new model.',
      });
      return;
    }

    setIsSaving(true);
    setFeedback({ success: null, error: null });

    try {
      const catalogMeta = CONFIGURABLE_CATALOG_PROVIDERS[integration.id];

      if (selectedRow) {
        await patchWorkspaceIntegration(selectedRow.id, {
          name: trimmedLabel,
          status: 'active',
          is_default: isDefault,
          config: {
            kind: 'chat_model',
            model: trimmedModel,
            display_label: trimmedLabel,
            ...(trimmedApiKey ? { api_key: trimmedApiKey } : {}),
          },
        });
      } else {
        await createWorkspaceIntegration({
          catalog_id: integration.id,
          category: catalogMeta.category,
          provider: catalogMeta.provider,
          name: trimmedLabel,
          status: 'active',
          is_default: isDefault,
          config: {
            kind: 'chat_model',
            model: trimmedModel,
            display_label: trimmedLabel,
            api_key: trimmedApiKey,
          },
        });
      }

      setFeedback({
        success: selectedRow
          ? 'Integration updated.'
          : 'Model connected for your workspace.',
        error: null,
      });
      setApiKey('');
      onSaved();
    } catch (error) {
      setFeedback({
        success: null,
        error: errorMessage(error, 'Failed to save integration'),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const hasActiveChatModelWithKey = activeRows.some(
    (row) =>
      row.status === 'active' &&
      row.config.kind === 'chat_model' &&
      row.config.has_api_key
  );

  const dialogStatusLabel =
    canConfigure && hasActiveChatModelWithKey
      ? 'Connected'
      : integrationStatusLabel(integration.status);

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
          <div className="space-y-4">
            <FormStatusAlerts
              error={feedback.error}
              success={feedback.success}
            />

            {activeRows.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Configured models</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddModel}
                  >
                    Add model
                  </Button>
                </div>
                <ul className="space-y-2">
                  {activeRows.map((row) => (
                    <li key={row.id}>
                      <Button
                        type="button"
                        variant={
                          selectedRowId === row.id ? 'secondary' : 'outline'
                        }
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => handleSelectRow(row)}
                      >
                        {row.config.kind === 'chat_model'
                          ? row.config.display_label
                          : row.name}
                        {row.is_default ? ' (default)' : ''}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="integration-display-label">Display label</Label>
              <Input
                id="integration-display-label"
                value={displayLabel}
                onChange={(event) => setDisplayLabel(event.target.value)}
                placeholder="Gemini 3.6"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="integration-model-id">Model id</Label>
              <Input
                id="integration-model-id"
                value={modelId}
                onChange={(event) => setModelId(event.target.value)}
                placeholder={DEFAULT_GEMINI_MODEL.value}
              />
              <p className="text-muted-foreground text-xs">
                Provider model id sent to the API (e.g. gemini-3.6-flash).
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="integration-api-key">API key</Label>
              <Input
                id="integration-api-key"
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={
                  selectedRow?.config.kind === 'chat_model' &&
                  selectedRow.config.has_api_key
                    ? 'Leave blank to keep existing key'
                    : 'Paste your API key'
                }
                autoComplete="off"
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="integration-is-default"
                checked={isDefault}
                onCheckedChange={(checked) => setIsDefault(checked === true)}
              />
              <Label htmlFor="integration-is-default">
                Use as workspace default in chat
              </Label>
            </div>
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-between">
          <IntegrationVisitWebsiteButton href={externalHref} />
          <div className="flex flex-wrap gap-2">
            {canConfigure ? (
              <Button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving}
              >
                {selectedRow ? 'Save changes' : 'Connect model'}
              </Button>
            ) : (
              <IntegrationPlannedActions />
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
