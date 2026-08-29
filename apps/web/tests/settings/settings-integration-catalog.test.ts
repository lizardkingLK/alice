import { describe, expect, it } from 'vitest';
import {
  WORKSPACE_INTEGRATIONS,
  filterWorkspaceIntegrations,
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
