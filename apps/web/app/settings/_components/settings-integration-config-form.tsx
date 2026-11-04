'use client';

import type { IntegrationWire } from '@repo/types';
import {
  chatModelSuggestionsForProvider,
  resolveConfiguredChatModelStatus,
} from '@repo/types';
import { Button } from '@repo/ui/components/ui/button';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { AlertCircle } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import {
  configuredModelLabel,
  defaultModelForProvider,
  integrationApiKeyPlaceholder,
  type IntegrationSaveFeedback,
} from '@/app/settings/_components/settings-integration-detail-dialog.helpers';
import { FormStatusAlerts } from '@/app/work-items/_components/work-item-form/work-item-form-alerts';

type IntegrationConfigFormProps = {
  readonly provider: string;
  readonly activeRows: readonly IntegrationWire[];
  readonly selectedRowId: string | null;
  readonly selectedRow: IntegrationWire | null;
  readonly displayLabel: string;
  readonly modelId: string;
  readonly apiKey: string;
  readonly isDefault: boolean;
  readonly feedback: IntegrationSaveFeedback;
  /* eslint-disable no-unused-vars -- callback param names document values */
  readonly onSelectRow: (row: IntegrationWire) => void;
  readonly onAddModel: () => void;
  readonly onDisplayLabelChange: (value: string) => void;
  readonly onModelIdChange: (value: string) => void;
  readonly onApiKeyChange: (value: string) => void;
  readonly onIsDefaultChange: (value: boolean) => void;
  readonly onApplySuggestedModel: (
    modelId: string,
    displayLabel: string
  ) => void;
  /* eslint-enable no-unused-vars */
};

export function IntegrationConfigForm({
  provider,
  activeRows,
  selectedRowId,
  selectedRow,
  displayLabel,
  modelId,
  apiKey,
  isDefault,
  feedback,
  onSelectRow,
  onAddModel,
  onDisplayLabelChange,
  onModelIdChange,
  onApiKeyChange,
  onIsDefaultChange,
  onApplySuggestedModel,
}: Readonly<IntegrationConfigFormProps>) {
  const suggestions = chatModelSuggestionsForProvider(provider);
  const providerDefault = defaultModelForProvider(provider);
  const modelAssessment = resolveConfiguredChatModelStatus(provider, modelId);
  const showModelWarning = modelAssessment.warning !== null;

  return (
    <div className="space-y-4">
      <FormStatusAlerts error={feedback.error} success={feedback.success} />

      {activeRows.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>Configured models</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onAddModel}
            >
              Add model
            </Button>
          </div>
          <ul className="space-y-2">
            {activeRows.map((row) => {
              const rowModel =
                row.config.kind === 'chat_model' ? row.config.model : '';
              const rowStatus = resolveConfiguredChatModelStatus(
                provider,
                rowModel
              );
              return (
                <li key={row.id}>
                  <Button
                    type="button"
                    variant={selectedRowId === row.id ? 'secondary' : 'outline'}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => onSelectRow(row)}
                  >
                    <span className="truncate">
                      {configuredModelLabel(row)}
                      {rowStatus.status === 'retired' ? ' (retired)' : ''}
                    </span>
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {suggestions.length > 0 ? (
        <div className="space-y-2">
          <Label>Suggested {provider} models</Label>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => {
              const isActive = modelId === suggestion.value;
              return (
                <Button
                  key={suggestion.value}
                  type="button"
                  size="sm"
                  variant={isActive ? 'secondary' : 'outline'}
                  className="cursor-pointer"
                  onClick={() =>
                    onApplySuggestedModel(suggestion.value, suggestion.label)
                  }
                >
                  {suggestion.label}
                </Button>
              );
            })}
          </div>
          <p className="text-muted-foreground text-xs">
            Suggested ids are pinned dated versions. Alice does not auto-update
            configured models when a vendor retires one.
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="integration-display-label">Display label</Label>
        <Input
          id="integration-display-label"
          value={displayLabel}
          onChange={(event) => onDisplayLabelChange(event.target.value)}
          placeholder={providerDefault.label}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="integration-model-id">Model id</Label>
        <Input
          id="integration-model-id"
          value={modelId}
          onChange={(event) => onModelIdChange(event.target.value)}
          placeholder={providerDefault.value}
        />
        <p className="text-muted-foreground text-xs">
          Provider model id sent to the API (e.g. {providerDefault.value}).
        </p>
        {showModelWarning ? (
          <div
            className={cn(
              'flex flex-col gap-2 rounded-lg border p-3 text-sm',
              modelAssessment.status === 'retired'
                ? 'border-destructive/20 bg-destructive/10 text-destructive'
                : 'border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-200'
            )}
            role="status"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{modelAssessment.warning}</span>
            </div>
            {modelAssessment.status === 'retired' ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="self-start"
                onClick={() =>
                  onApplySuggestedModel(
                    modelAssessment.recommended.value,
                    modelAssessment.recommended.label
                  )
                }
              >
                Use {modelAssessment.recommended.label}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="integration-api-key">API key</Label>
        <Input
          id="integration-api-key"
          type="password"
          value={apiKey}
          onChange={(event) => onApiKeyChange(event.target.value)}
          placeholder={integrationApiKeyPlaceholder(selectedRow)}
          autoComplete="off"
        />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="integration-is-default"
          checked={isDefault}
          onCheckedChange={(checked) => onIsDefaultChange(checked === true)}
        />
        <Label htmlFor="integration-is-default">
          Use as workspace default in chat
        </Label>
      </div>
    </div>
  );
}
