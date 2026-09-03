import { describe, expect, it } from 'vitest';
import {
  WORKSPACE_INTEGRATIONS,
  filterWorkspaceIntegrations,
  integrationRowsForCatalog,
  isCatalogConnected,
  isConfigurableCatalog,
} from '@/app/settings/_components/settings-integration-catalog';
import { integrationInitials } from '@/app/settings/_components/settings-integration-initials-link';

describe('integrationInitials', () => {
  it('uses first letters of two-word names', () => {
    expect(integrationInitials('Google Gemini')).toBe('GG');
    expect(integrationInitials('GitHub Copilot')).toBe('GC');
    expect(integrationInitials('Microsoft Teams')).toBe('MT');
  });

  it('uses first two letters of single-word names', () => {
    expect(integrationInitials('Slack')).toBe('SL');
    expect(integrationInitials('Figma')).toBe('FI');
  });
});

describe('filterWorkspaceIntegrations', () => {
  it('defaults planned integrations from the catalog factory', () => {
    const figma = WORKSPACE_INTEGRATIONS.find((item) => item.id === 'figma');
    expect(figma).toMatchObject({
      status: 'planned',
      defaultConnected: false,
      filterTab: 'design',
    });
  });

  it('returns all integrations for the all tab', () => {
    expect(
      filterWorkspaceIntegrations(WORKSPACE_INTEGRATIONS, 'all', '')
    ).toHaveLength(WORKSPACE_INTEGRATIONS.length);
  });

  it('filters by category tab', () => {
    const communication = filterWorkspaceIntegrations(
      WORKSPACE_INTEGRATIONS,
      'communication',
      ''
    );
    expect(
      communication.every((item) => item.filterTab === 'communication')
    ).toBe(true);
    expect(communication.some((item) => item.id === 'slack')).toBe(true);
  });

  it('filters planned integrations only on the planned tab', () => {
    const planned = filterWorkspaceIntegrations(
      WORKSPACE_INTEGRATIONS,
      'planned',
      ''
    );
    expect(planned.every((item) => item.status === 'planned')).toBe(true);
    expect(planned.some((item) => item.id === 'figma')).toBe(true);
  });

  it('matches search query against name, description, and website', () => {
    expect(
      filterWorkspaceIntegrations(
        WORKSPACE_INTEGRATIONS,
        'all',
        'google gemini'
      )
    ).toEqual([expect.objectContaining({ id: 'alice-gemini' })]);
    expect(
      filterWorkspaceIntegrations(WORKSPACE_INTEGRATIONS, 'all', 'linear.app')
    ).toEqual([expect.objectContaining({ id: 'linear' })]);
  });
});

describe('isCatalogConnected', () => {
  it('returns true when an active row has an API key configured', () => {
    expect(
      isCatalogConnected('alice-gemini', [
        {
          catalog_id: 'alice-gemini',
          status: 'active',
          config: { kind: 'chat_model', has_api_key: true },
        },
      ])
    ).toBe(true);
  });

  it('returns false when rows are disabled or missing API keys', () => {
    expect(
      isCatalogConnected('alice-gemini', [
        {
          catalog_id: 'alice-gemini',
          status: 'disabled',
          config: { kind: 'chat_model', has_api_key: true },
        },
      ])
    ).toBe(false);

    expect(
      isCatalogConnected('alice-gemini', [
        {
          catalog_id: 'alice-gemini',
          status: 'active',
          config: { kind: 'chat_model', has_api_key: false },
        },
      ])
    ).toBe(false);
  });
});

describe('isConfigurableCatalog', () => {
  it('recognizes chat model catalog ids', () => {
    expect(isConfigurableCatalog('alice-gemini')).toBe(true);
    expect(isConfigurableCatalog('openai')).toBe(true);
    expect(isConfigurableCatalog('slack')).toBe(false);
  });
});

describe('integrationRowsForCatalog', () => {
  it('returns only rows matching the catalog id', () => {
    const rows = [
      { catalog_id: 'alice-gemini', status: 'active', config: {} },
      { catalog_id: 'openai', status: 'active', config: {} },
    ];

    expect(integrationRowsForCatalog(rows, 'openai')).toEqual([rows[1]]);
  });
});
