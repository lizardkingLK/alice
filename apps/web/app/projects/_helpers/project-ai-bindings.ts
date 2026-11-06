import type { ProjectIntegrationBindingItem } from '@repo/types/api/v1';

/**
 * Map wizard AI model selection to create-project `integration_bindings`.
 * Returns `undefined` when nothing is selected so the field can be omitted.
 */
export function mapAiBindingsToIntegrationBindings(
  aiBindingIds: readonly string[],
  defaultAiIntegrationId: string | null
): ProjectIntegrationBindingItem[] | undefined {
  if (aiBindingIds.length === 0) {
    return undefined;
  }

  return aiBindingIds.map((integration_id) => ({
    integration_id,
    is_default_for_project: integration_id === defaultAiIntegrationId,
  }));
}

export type AiBindingSelection = {
  readonly aiBindingIds: readonly string[];
  readonly defaultAiIntegrationId: string | null;
};

/** Toggle an org AI model in/out of the project selection; keep a valid default. */
export function toggleAiBindingSelection(
  current: AiBindingSelection,
  modelId: string,
  checked: boolean
): AiBindingSelection {
  if (checked) {
    const aiBindingIds = current.aiBindingIds.includes(modelId)
      ? [...current.aiBindingIds]
      : [...current.aiBindingIds, modelId];
    return {
      aiBindingIds,
      defaultAiIntegrationId: current.defaultAiIntegrationId ?? modelId,
    };
  }

  const aiBindingIds = current.aiBindingIds.filter((id) => id !== modelId);
  const defaultAiIntegrationId =
    current.defaultAiIntegrationId === modelId
      ? (aiBindingIds[0] ?? null)
      : current.defaultAiIntegrationId;

  return { aiBindingIds, defaultAiIntegrationId };
}
