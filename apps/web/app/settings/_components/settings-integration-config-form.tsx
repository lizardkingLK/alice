'use client';

import type { IntegrationWire } from '@repo/types';
import { Button } from '@repo/ui/components/ui/button';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import {
  configuredModelLabel,
  DEFAULT_GEMINI_MODEL,
  integrationApiKeyPlaceholder,
  type IntegrationSaveFeedback,
} from '@/app/settings/_components/settings-integration-detail-dialog.helpers';
import { FormStatusAlerts } from '@/app/work-items/_components/work-item-form/work-item-form-alerts';

type IntegrationConfigFormProps = {
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
  /* eslint-enable no-unused-vars */
};

export function IntegrationConfigForm({
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
}: Readonly<IntegrationConfigFormProps>) {
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
            {activeRows.map((row) => (
              <li key={row.id}>
                <Button
                  type="button"
                  variant={selectedRowId === row.id ? 'secondary' : 'outline'}
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => onSelectRow(row)}
                >
                  {configuredModelLabel(row)}
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
          onChange={(event) => onDisplayLabelChange(event.target.value)}
          placeholder="Gemini 3.6"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="integration-model-id">Model id</Label>
        <Input
          id="integration-model-id"
          value={modelId}
          onChange={(event) => onModelIdChange(event.target.value)}
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
