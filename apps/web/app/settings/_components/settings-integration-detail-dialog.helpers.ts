import { CHAT_MODELS, type IntegrationWire } from '@repo/types';
import {
  CONFIGURABLE_CATALOG_PROVIDERS,
  integrationStatusLabel,
  isConfigurableCatalog,
  type WorkspaceIntegration,
} from '@/app/settings/_components/settings-integration-catalog';
import {
  createWorkspaceIntegration,
  patchWorkspaceIntegration,
} from '@/app/settings/_services/integrations.mutations.client';
import { errorMessage } from '@/lib/errors/error-message';

const DEFAULT_GEMINI_MODEL = CHAT_MODELS.GEMINI_3_6_FLASH;

export { DEFAULT_GEMINI_MODEL };

export type IntegrationFormState = {
  selectedRowId: string | null;
  modelId: string;
  displayLabel: string;
  isDefault: boolean;
};

export type IntegrationSaveFeedback = {
  success: string | null;
  error: string | null;
};

export function integrationSaveButtonLabel(
  isSaving: boolean,
  isEditingExistingRow: boolean
): string {
  if (isSaving) {
    return isEditingExistingRow ? 'Saving...' : 'Connecting...';
  }
  return isEditingExistingRow ? 'Save changes' : 'Connect model';
}

export function integrationApiKeyPlaceholder(
  selectedRow: IntegrationWire | null
): string {
  if (
    selectedRow?.config.kind === 'chat_model' &&
    selectedRow.config.has_api_key
  ) {
    return 'Leave blank to keep existing key';
  }
  return 'Paste your API key';
}

export function integrationDialogStatusLabel(
  integration: WorkspaceIntegration,
  activeRows: readonly IntegrationWire[]
): string {
  const canConfigure = isConfigurableCatalog(integration.id);
  const hasActiveChatModelWithKey = activeRows.some(
    (row) =>
      row.status === 'active' &&
      row.config.kind === 'chat_model' &&
      row.config.has_api_key
  );

  if (canConfigure && hasActiveChatModelWithKey) {
    return 'Connected';
  }

  return integrationStatusLabel(integration.status);
}

export function configuredModelLabel(row: IntegrationWire): string {
  const name =
    row.config.kind === 'chat_model' ? row.config.display_label : row.name;
  return row.is_default ? `${name} (default)` : name;
}

export function createFormStateFromRows(
  activeRows: readonly IntegrationWire[]
): IntegrationFormState {
  const defaultRow =
    activeRows.find((row) => row.is_default) ?? activeRows[0] ?? null;

  return {
    selectedRowId: defaultRow?.id ?? null,
    modelId:
      defaultRow?.config.kind === 'chat_model'
        ? defaultRow.config.model
        : DEFAULT_GEMINI_MODEL.value,
    displayLabel:
      defaultRow?.config.kind === 'chat_model'
        ? defaultRow.config.display_label
        : DEFAULT_GEMINI_MODEL.label,
    isDefault: defaultRow?.is_default ?? activeRows.length === 0,
  };
}

export function createFormStateForNewModel(
  activeRows: readonly IntegrationWire[]
): IntegrationFormState {
  return {
    selectedRowId: null,
    modelId: DEFAULT_GEMINI_MODEL.value,
    displayLabel: DEFAULT_GEMINI_MODEL.label,
    isDefault: activeRows.length === 0,
  };
}

export function createFormStateFromRow(
  row: IntegrationWire
): IntegrationFormState {
  const chatConfig = row.config.kind === 'chat_model' ? row.config : null;

  return {
    selectedRowId: row.id,
    modelId: chatConfig?.model ?? DEFAULT_GEMINI_MODEL.value,
    displayLabel: chatConfig?.display_label ?? DEFAULT_GEMINI_MODEL.label,
    isDefault: row.is_default,
  };
}

export async function saveIntegrationModel(params: {
  catalogId: keyof typeof CONFIGURABLE_CATALOG_PROVIDERS;
  selectedRow: IntegrationWire | null;
  modelId: string;
  displayLabel: string;
  apiKey: string;
  isDefault: boolean;
}): Promise<IntegrationSaveFeedback> {
  const trimmedApiKey = params.apiKey.trim();
  const trimmedModel = params.modelId.trim();
  const trimmedLabel = params.displayLabel.trim();

  if (!trimmedModel || !trimmedLabel) {
    return {
      success: null,
      error: 'Model id and display label are required.',
    };
  }

  if (!params.selectedRow && !trimmedApiKey) {
    return {
      success: null,
      error: 'API key is required when connecting a new model.',
    };
  }

  try {
    const catalogMeta = CONFIGURABLE_CATALOG_PROVIDERS[params.catalogId];

    if (params.selectedRow) {
      await patchWorkspaceIntegration(params.selectedRow.id, {
        name: trimmedLabel,
        status: 'active',
        is_default: params.isDefault,
        config: {
          kind: 'chat_model',
          model: trimmedModel,
          display_label: trimmedLabel,
          ...(trimmedApiKey ? { api_key: trimmedApiKey } : {}),
        },
      });

      return { success: 'Integration updated.', error: null };
    }

    await createWorkspaceIntegration({
      catalog_id: params.catalogId,
      category: catalogMeta.category,
      provider: catalogMeta.provider,
      name: trimmedLabel,
      status: 'active',
      is_default: params.isDefault,
      config: {
        kind: 'chat_model',
        model: trimmedModel,
        display_label: trimmedLabel,
        api_key: trimmedApiKey,
      },
    });

    return {
      success: 'Model connected for your workspace.',
      error: null,
    };
  } catch (error) {
    return {
      success: null,
      error: errorMessage(error, 'Failed to save integration'),
    };
  }
}
