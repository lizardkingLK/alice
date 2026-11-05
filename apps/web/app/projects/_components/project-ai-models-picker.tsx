'use client';

import type { ChatModelOption } from '@repo/types';
import { Button } from '@repo/ui/components/ui/button';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
import { Label } from '@repo/ui/components/ui/label';
import { Star } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import {
  chatModelDisplayLabel,
  chatProviderDisplayLabel,
} from '@/app/chat/_services/chat-models-api.shared';

export type ProjectAiModelsPickerProps = {
  readonly models: readonly ChatModelOption[];
  readonly aiBindingIds: readonly string[];
  readonly defaultAiIntegrationId: string | null;
  readonly idPrefix: string;
  readonly disabled?: boolean;
  readonly emptyMessage: string;
  // eslint-disable-next-line no-unused-vars -- selection callbacks
  readonly onToggleModel: (modelId: string, checked: boolean) => void;
  // eslint-disable-next-line no-unused-vars -- selection callbacks
  readonly onSetDefault: (modelId: string) => void;
};

/**
 * Shared multi-select + project-default star list for org AI chat models.
 * Used by create-wizard Integrations and project details AI card.
 */
export function ProjectAiModelsPicker({
  models,
  aiBindingIds,
  defaultAiIntegrationId,
  idPrefix,
  disabled = false,
  emptyMessage,
  onToggleModel,
  onSetDefault,
}: Readonly<ProjectAiModelsPickerProps>) {
  if (models.length === 0) {
    return <p className="text-muted-foreground text-xs">{emptyMessage}</p>;
  }

  const selected = new Set(aiBindingIds);

  return (
    <ul className="space-y-2">
      {models.map((model) => {
        const isSelected = selected.has(model.id);
        const isDefault = defaultAiIntegrationId === model.id;
        const label = chatModelDisplayLabel(model);
        const provider = chatProviderDisplayLabel(model.provider);
        const checkboxId = `${idPrefix}-${model.id}`;

        return (
          <li key={model.id}>
            <div className="border-border bg-muted/20 flex items-center gap-3 rounded-lg border p-3">
              <Checkbox
                id={checkboxId}
                checked={isSelected}
                disabled={disabled}
                onCheckedChange={(value) =>
                  onToggleModel(model.id, value === true)
                }
                className="cursor-pointer"
              />
              <div className="grid min-w-0 flex-1 gap-0.5">
                <Label
                  htmlFor={checkboxId}
                  className="cursor-pointer truncate text-sm font-medium select-none"
                  title={label}
                >
                  {label}
                </Label>
                <p className="text-muted-foreground truncate text-xs">
                  {provider}
                </p>
              </div>
              {isSelected ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  disabled={disabled}
                  aria-label={
                    isDefault
                      ? `${label} is the project default`
                      : `Set ${label} as project default`
                  }
                  aria-pressed={isDefault}
                  onClick={() => onSetDefault(model.id)}
                >
                  <Star
                    className={cn(
                      'size-4',
                      isDefault && 'fill-current text-amber-500'
                    )}
                  />
                </Button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
