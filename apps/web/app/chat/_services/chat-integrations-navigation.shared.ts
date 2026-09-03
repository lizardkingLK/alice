import { IntegrationCategory } from '@repo/types';
import { settingsIntegrationsHref } from '@/app/settings/_services/settings-integrations-navigation.shared';

export function chatAiAgentsIntegrationsHref(): string {
  return settingsIntegrationsHref(IntegrationCategory.ai_agent);
}

export {
  INTEGRATION_CATEGORY_FILTER_TAB,
  parseIntegrationsCategoryFilter,
  settingsIntegrationsHref,
} from '@/app/settings/_services/settings-integrations-navigation.shared';
