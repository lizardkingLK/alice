import {
  WORKSPACE_INTEGRATIONS,
  type WorkspaceIntegration,
} from '@/app/settings/_components/settings-integration-catalog';

export type ProjectIntegrationFilterTab =
  | 'all'
  | 'source-control'
  | 'project-management'
  | 'ai-agents'
  | 'communication'
  | 'design'
  | 'productivity'
  | 'planned';

export const PROJECT_INTEGRATION_FILTER_TABS: ReadonlyArray<{
  readonly id: ProjectIntegrationFilterTab;
  readonly label: string;
}> = [
  { id: 'all', label: 'All integrations' },
  { id: 'source-control', label: 'Source control' },
  { id: 'project-management', label: 'Project management' },
  { id: 'ai-agents', label: 'AI agents' },
  { id: 'communication', label: 'Communication' },
  { id: 'design', label: 'Design & diagramming' },
  { id: 'productivity', label: 'Productivity' },
  { id: 'planned', label: 'Coming soon' },
];

const CATALOG_GROUP_TABS = new Set<ProjectIntegrationFilterTab>([
  'communication',
  'design',
  'productivity',
  'planned',
]);

export function isCatalogGroupTab(
  tab: ProjectIntegrationFilterTab
): tab is 'communication' | 'design' | 'productivity' | 'planned' {
  return CATALOG_GROUP_TABS.has(tab);
}

export function matchesIntegrationSearch(
  haystack: string,
  searchQuery: string
): boolean {
  const normalized = searchQuery.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  return haystack.toLowerCase().includes(normalized);
}

function catalogItemMatchesTab(
  item: WorkspaceIntegration,
  tab: ProjectIntegrationFilterTab
): boolean {
  switch (tab) {
    case 'all':
      return (
        item.filterTab === 'communication' ||
        item.filterTab === 'design' ||
        item.filterTab === 'productivity' ||
        item.status === 'planned'
      );
    case 'planned':
      return item.status === 'planned';
    case 'communication':
    case 'design':
    case 'productivity':
      return item.filterTab === tab;
    default:
      return false;
  }
}

/** Planned / non-AI catalog cards shown on the project Integrations marketplace. */
export function filterProjectMarketplaceCatalog(
  tab: ProjectIntegrationFilterTab,
  searchQuery: string
): WorkspaceIntegration[] {
  return WORKSPACE_INTEGRATIONS.filter((item) => {
    if (item.filterTab === 'ai-agents') {
      return false;
    }
    if (!catalogItemMatchesTab(item, tab)) {
      return false;
    }
    return matchesIntegrationSearch(
      `${item.name} ${item.description} ${item.websiteUrl}`,
      searchQuery
    );
  });
}

export function sectionVisibleForTab(
  section: 'source-control' | 'project-management' | 'ai-agents' | 'catalog',
  tab: ProjectIntegrationFilterTab
): boolean {
  if (tab === 'all') {
    return true;
  }
  if (section === 'catalog') {
    return isCatalogGroupTab(tab);
  }
  return tab === section;
}

export type MarketplaceSectionVisibility = {
  readonly showSourceControl: boolean;
  readonly showProjectManagement: boolean;
  readonly showAiAgents: boolean;
  readonly showCatalog: boolean;
  readonly hasVisibleContent: boolean;
};

export function resolveMarketplaceSectionVisibility(
  activeFilter: ProjectIntegrationFilterTab,
  searchQuery: string,
  catalogItemCount: number
): MarketplaceSectionVisibility {
  const showSourceControl =
    sectionVisibleForTab('source-control', activeFilter) &&
    matchesIntegrationSearch('source control github repository', searchQuery);
  const showProjectManagement =
    sectionVisibleForTab('project-management', activeFilter) &&
    matchesIntegrationSearch(
      'project management jira atlassian import',
      searchQuery
    );
  const showAiAgents =
    sectionVisibleForTab('ai-agents', activeFilter) &&
    matchesIntegrationSearch('ai agents chat models', searchQuery);
  const showCatalog = sectionVisibleForTab('catalog', activeFilter);

  return {
    showSourceControl,
    showProjectManagement,
    showAiAgents,
    showCatalog,
    hasVisibleContent:
      showSourceControl ||
      showProjectManagement ||
      showAiAgents ||
      (showCatalog && catalogItemCount > 0),
  };
}
