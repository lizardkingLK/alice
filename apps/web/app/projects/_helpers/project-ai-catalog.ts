import {
  CONFIGURABLE_CATALOG_PROVIDERS,
  type ConfigurableCatalogId,
} from '@/app/settings/_components/settings-integration-catalog';
import { chatProviderDisplayLabel } from '@/app/chat/_services/chat-models-api.shared';

const PROVIDER_TO_CATALOG: Readonly<Record<string, ConfigurableCatalogId>> = {
  gemini: 'alice-gemini',
  spacexai: 'alice-spacexai',
  openai: 'openai',
  anthropic: 'anthropic',
};

export type ProjectAiProviderGroupMeta = {
  readonly catalogId: ConfigurableCatalogId;
  readonly provider: string;
  readonly label: string;
};

export function catalogIdForChatProvider(
  provider: string
): ConfigurableCatalogId | null {
  return PROVIDER_TO_CATALOG[provider] ?? null;
}

export function projectAiProviderGroups(): ProjectAiProviderGroupMeta[] {
  return (
    Object.entries(CONFIGURABLE_CATALOG_PROVIDERS) as Array<
      [ConfigurableCatalogId, { provider: string; category: string }]
    >
  ).map(([catalogId, meta]) => ({
    catalogId,
    provider: meta.provider,
    label: chatProviderDisplayLabel(meta.provider),
  }));
}
