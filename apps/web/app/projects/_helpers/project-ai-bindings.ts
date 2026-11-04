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
