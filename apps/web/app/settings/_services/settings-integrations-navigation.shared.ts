import { IntegrationCategory } from '@repo/types';
import type { IntegrationFilterTab } from '@/app/settings/_components/settings-integration-catalog';

/** Maps DB `integrations.category` to Settings marketplace filter tabs. */
export const INTEGRATION_CATEGORY_FILTER_TAB: Record<
  IntegrationCategory,
  IntegrationFilterTab
> = {
  [IntegrationCategory.ai_agent]: 'ai-agents',
  [IntegrationCategory.communication]: 'communication',
  [IntegrationCategory.design]: 'design',
  [IntegrationCategory.productivity]: 'productivity',
};

const INTEGRATION_FILTER_TABS: readonly IntegrationFilterTab[] = [
  'all',
  'ai-agents',
  'communication',
  'design',
  'productivity',
  'planned',
];

export function settingsIntegrationsHref(
  category: IntegrationCategory
): string {
  const filterTab = INTEGRATION_CATEGORY_FILTER_TAB[category];
  const params = new URLSearchParams({
    tab: 'integrations',
    category: filterTab,
  });
  return `/settings?${params.toString()}`;
}

export function parseIntegrationsCategoryFilter(
  category: string | undefined | null
): IntegrationFilterTab | undefined {
  if (!category) {
    return undefined;
  }

  return INTEGRATION_FILTER_TABS.includes(category as IntegrationFilterTab)
    ? (category as IntegrationFilterTab)
    : undefined;
}
