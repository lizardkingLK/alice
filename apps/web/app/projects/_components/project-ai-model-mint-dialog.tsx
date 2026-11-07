'use client';

import { useEffect, useMemo, useState } from 'react';
import type { IntegrationWire } from '@repo/types';
import type { ProjectAiModelOption } from '@repo/types/api/v1';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Loader2 } from '@repo/ui/lib/icons';
import { IntegrationConfigForm } from '@/app/settings/_components/settings-integration-config-form';
import {
  CONFIGURABLE_CATALOG_PROVIDERS,
  type ConfigurableCatalogId,
} from '@/app/settings/_components/settings-integration-catalog';
import {
  defaultModelForProvider,
  integrationSaveButtonLabel,
  saveIntegrationModel,
  type IntegrationSaveFeedback,
} from '@/app/settings/_components/settings-integration-detail-dialog.helpers';
import { catalogIdForChatProvider } from '@/app/projects/_helpers/project-ai-catalog';
import { afterDialogClose } from '@/lib/dialog-close';
import { chatProviderDisplayLabel } from '@/app/chat/_services/chat-models-api.shared';

export type ProjectAiModelMintDialogProps = {
  readonly open: boolean;
  readonly projectId: string;
  readonly catalogId: ConfigurableCatalogId | null;
  readonly editModel: ProjectAiModelOption | null;
  // eslint-disable-next-line no-unused-vars -- open change callback
  readonly onOpenChange: (open: boolean) => void;
  readonly onSaved: () => void;
};

type FormState = {
  displayLabel: string;
  modelId: string;
  apiKey: string;
  isDefault: boolean;
};

function projectModelToWire(
  model: ProjectAiModelOption,
  catalogId: ConfigurableCatalogId,
  projectId: string
): IntegrationWire {
  return {
    id: model.id,
    catalog_id: catalogId,
    category: 'ai_agent',
    scope: 'project',
    project_id: projectId,
    provider: model.provider,
    name: model.name,
    status: 'active',
    config: {
      kind: 'chat_model',
      model: model.model,
      display_label: model.display_label,
      has_api_key: model.has_api_key,
    },
    is_default: false,
    sort_order: 0,
    created_by: model.created_by,
    created_by_name: model.created_by_name,
    created_at: new Date(),
    updated_at: new Date(),
  };
}

function initialFormState(
  catalogId: ConfigurableCatalogId | null,
  editModel: ProjectAiModelOption | null
): FormState {
  if (editModel) {
    return {
      displayLabel: editModel.display_label,
      modelId: editModel.model,
      apiKey: '',
      isDefault: false,
    };
  }
  const provider = catalogId
    ? CONFIGURABLE_CATALOG_PROVIDERS[catalogId].provider
    : 'gemini';
  const defaults = defaultModelForProvider(provider);
  return {
    displayLabel: defaults.label,
    modelId: defaults.value,
    apiKey: '',
    isDefault: false,
  };
}

function mintDialogTitle(
  editModel: ProjectAiModelOption | null,
  provider: string | null
): string {
  if (editModel) {
    return `Edit ${chatProviderDisplayLabel(editModel.provider)} model`;
  }
  if (provider) {
    return `Add ${chatProviderDisplayLabel(provider)} model`;
  }
  return 'Add AI model';
}

const EMPTY_FEEDBACK: IntegrationSaveFeedback = {
  success: null,
  error: null,
};

export function ProjectAiModelMintDialog({
  open,
  projectId,
  catalogId,
  editModel,
  onOpenChange,
  onSaved,
}: Readonly<ProjectAiModelMintDialogProps>) {
  const [form, setForm] = useState<FormState>(() =>
    initialFormState(catalogId, editModel)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] =
    useState<IntegrationSaveFeedback>(EMPTY_FEEDBACK);

  useEffect(() => {
    if (!open) {
      return afterDialogClose(() => {
        setForm(initialFormState(null, null));
        setFeedback(EMPTY_FEEDBACK);
        setIsSaving(false);
      });
    }
    setForm(initialFormState(catalogId, editModel));
    setFeedback(EMPTY_FEEDBACK);
  }, [open, catalogId, editModel]);

  const provider =
    editModel?.provider ??
    (catalogId ? CONFIGURABLE_CATALOG_PROVIDERS[catalogId].provider : null);
  const resolvedCatalogId =
    catalogId ??
    (editModel ? catalogIdForChatProvider(editModel.provider) : null);

  const selectedRow = useMemo(() => {
    if (!editModel || !resolvedCatalogId) {
      return null;
    }
    return projectModelToWire(editModel, resolvedCatalogId, projectId);
  }, [editModel, projectId, resolvedCatalogId]);

  const handleSave = async () => {
    if (!resolvedCatalogId || !provider) {
      setFeedback({
        success: null,
        error: 'Choose a provider before saving.',
      });
      return;
    }

    setIsSaving(true);
    setFeedback(EMPTY_FEEDBACK);
    const result = await saveIntegrationModel({
      catalogId: resolvedCatalogId,
      selectedRow,
      modelId: form.modelId,
      displayLabel: form.displayLabel,
      apiKey: form.apiKey,
      isDefault: form.isDefault,
      scope: 'project',
      projectId,
    });
    setFeedback(result);
    setIsSaving(false);

    if (result.success) {
      onSaved();
      onOpenChange(false);
    }
  };

  const title = mintDialogTitle(editModel, provider);
  const saveLabel = integrationSaveButtonLabel(isSaving, Boolean(editModel));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {provider ? (
          <IntegrationConfigForm
            provider={provider}
            activeRows={[]}
            selectedRowId={selectedRow?.id ?? null}
            selectedRow={selectedRow}
            displayLabel={form.displayLabel}
            modelId={form.modelId}
            apiKey={form.apiKey}
            isDefault={form.isDefault}
            feedback={feedback}
            showConfiguredModels={false}
            showDefaultCheckbox={!editModel}
            defaultCheckboxLabel="Mark as project default"
            fieldIdPrefix="project-ai"
            onSelectRow={() => undefined}
            onAddModel={() => undefined}
            onDisplayLabelChange={(value) =>
              setForm((current) => ({ ...current, displayLabel: value }))
            }
            onModelIdChange={(value) =>
              setForm((current) => ({ ...current, modelId: value }))
            }
            onApiKeyChange={(value) =>
              setForm((current) => ({ ...current, apiKey: value }))
            }
            onIsDefaultChange={(value) =>
              setForm((current) => ({ ...current, isDefault: value }))
            }
            onApplySuggestedModel={(modelId, displayLabel) =>
              setForm((current) => ({
                ...current,
                modelId,
                displayLabel,
              }))
            }
          />
        ) : (
          <p className="text-muted-foreground text-sm">
            Choose a provider before connecting a model.
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving || !resolvedCatalogId}
          >
            {isSaving ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : null}
            {saveLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
