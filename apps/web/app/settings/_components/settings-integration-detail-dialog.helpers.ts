import { defaultChatModelForProvider, type IntegrationWire } from '@repo/types';
import {
  CONFIGURABLE_CATALOG_PROVIDERS,
  integrationStatusLabel,
  isConfigurableCatalog,
  type ConfigurableCatalogId,
  type WorkspaceIntegration,
} from '@/app/settings/_components/settings-integration-catalog';
import {
  createWorkspaceIntegration,
  patchWorkspaceIntegration,
} from '@/app/settings/_services/integrations.mutations.client';
import { errorMessage } from '@/lib/errors/error-message';

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

export function providerForCatalog(catalogId: string): string | null {
  if (!isConfigurableCatalog(catalogId)) {
    return null;
  }
  return CONFIGURABLE_CATALOG_PROVIDERS[catalogId].provider;
}

export function defaultModelForProvider(provider: string) {
  return defaultChatModelForProvider(provider);
}

/** @deprecated Prefer `defaultModelForProvider(provider)`. */
export const DEFAULT_MODEL = defaultChatModelForProvider('gemini');

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
  activeRows: readonly IntegrationWire[],
  provider: string
): IntegrationFormState {
  const defaultRow =
    activeRows.find((row) => row.is_default) ?? activeRows[0] ?? null;
  const fallback = defaultChatModelForProvider(provider);

  return {
    selectedRowId: defaultRow?.id ?? null,
    modelId:
      defaultRow?.config.kind === 'chat_model'
        ? defaultRow.config.model
        : fallback.value,
    displayLabel:
      defaultRow?.config.kind === 'chat_model'
        ? defaultRow.config.display_label
        : fallback.label,
    isDefault: defaultRow?.is_default ?? activeRows.length === 0,
  };
}

export function createFormStateForNewModel(
  activeRows: readonly IntegrationWire[],
  provider: string
): IntegrationFormState {
  const fallback = defaultChatModelForProvider(provider);
  return {
    selectedRowId: null,
    modelId: fallback.value,
    displayLabel: fallback.label,
    isDefault: activeRows.length === 0,
  };
}

export function createFormStateFromRow(
  row: IntegrationWire
): IntegrationFormState {
  const chatConfig = row.config.kind === 'chat_model' ? row.config : null;
  const fallback = defaultChatModelForProvider(row.provider);

  return {
    selectedRowId: row.id,
    modelId: chatConfig?.model ?? fallback.value,
    displayLabel: chatConfig?.display_label ?? fallback.label,
    isDefault: row.is_default,
  };
}

export async function saveIntegrationModel(params: {
  catalogId: ConfigurableCatalogId;
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
