import { describe, expect, it } from 'vitest';
import {
  filterProjectMarketplaceCatalog,
  matchesIntegrationSearch,
  resolveMarketplaceSectionVisibility,
  sectionVisibleForTab,
} from '@/app/projects/_helpers/project-integrations-marketplace.shared';

describe('project-integrations-marketplace.shared', () => {
  it('matchesIntegrationSearch is case-insensitive and empty-safe', () => {
    expect(matchesIntegrationSearch('GitHub Repository', '')).toBe(true);
    expect(matchesIntegrationSearch('GitHub Repository', 'github')).toBe(true);
    expect(matchesIntegrationSearch('GitHub Repository', 'jira')).toBe(false);
  });

  it('sectionVisibleForTab shows all groups on all', () => {
    expect(sectionVisibleForTab('source-control', 'all')).toBe(true);
    expect(sectionVisibleForTab('project-management', 'all')).toBe(true);
    expect(sectionVisibleForTab('ai-agents', 'all')).toBe(true);
    expect(sectionVisibleForTab('catalog', 'all')).toBe(true);
  });

  it('sectionVisibleForTab scopes single groups', () => {
    expect(sectionVisibleForTab('source-control', 'source-control')).toBe(true);
    expect(sectionVisibleForTab('source-control', 'ai-agents')).toBe(false);
    expect(sectionVisibleForTab('catalog', 'communication')).toBe(true);
    expect(sectionVisibleForTab('catalog', 'source-control')).toBe(false);
  });

  it('filterProjectMarketplaceCatalog excludes AI agents and respects tab', () => {
    const communication = filterProjectMarketplaceCatalog('communication', '');
    expect(communication.length).toBeGreaterThan(0);
    expect(
      communication.every((item) => item.filterTab === 'communication')
    ).toBe(true);

    const all = filterProjectMarketplaceCatalog('all', 'slack');
    expect(all.some((item) => item.id === 'slack')).toBe(true);
    expect(all.every((item) => item.filterTab !== 'ai-agents')).toBe(true);
  });

  it('resolveMarketplaceSectionVisibility respects search and catalog count', () => {
    const all = resolveMarketplaceSectionVisibility('all', '', 2);
    expect(all.showSourceControl).toBe(true);
    expect(all.showAiAgents).toBe(true);
    expect(all.hasVisibleContent).toBe(true);

    const aiOnly = resolveMarketplaceSectionVisibility('all', 'ai agents', 0);
    expect(aiOnly.showSourceControl).toBe(false);
    expect(aiOnly.showAiAgents).toBe(true);
    expect(aiOnly.hasVisibleContent).toBe(true);
  });
});
