import { describe, expect, it } from 'vitest';
import { IntegrationCategory } from '@repo/types';
import {
  INTEGRATION_CATEGORY_FILTER_TAB,
  parseIntegrationsCategoryFilter,
  settingsIntegrationsHref,
} from '@/app/settings/_services/settings-integrations-navigation.shared';
import { chatAiAgentsIntegrationsHref } from '@/app/chat/_services/chat-integrations-navigation.shared';

describe('settingsIntegrationsHref', () => {
  it('maps ai_agent to the AI agents filter tab', () => {
    expect(settingsIntegrationsHref(IntegrationCategory.ai_agent)).toBe(
      '/settings?tab=integrations&category=ai-agents'
    );
  });

  it('maps every integration category to a filter tab', () => {
    for (const category of Object.values(IntegrationCategory)) {
      expect(INTEGRATION_CATEGORY_FILTER_TAB[category]).toBeTruthy();
      expect(settingsIntegrationsHref(category)).toContain(
        `category=${INTEGRATION_CATEGORY_FILTER_TAB[category]}`
      );
    }
  });
});

describe('parseIntegrationsCategoryFilter', () => {
  it('accepts known marketplace filter tabs', () => {
    expect(parseIntegrationsCategoryFilter('ai-agents')).toBe('ai-agents');
  });

  it('returns undefined for missing or unknown values', () => {
    expect(parseIntegrationsCategoryFilter(undefined)).toBeUndefined();
    expect(parseIntegrationsCategoryFilter('unknown-tab')).toBeUndefined();
  });
});

describe('chatAiAgentsIntegrationsHref', () => {
  it('points chat empty state to AI agents in settings', () => {
    expect(chatAiAgentsIntegrationsHref()).toBe(
      '/settings?tab=integrations&category=ai-agents'
    );
  });
});
