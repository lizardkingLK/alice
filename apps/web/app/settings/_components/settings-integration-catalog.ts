import integrationCatalogData from '@/app/settings/_components/settings-integration-catalog.data.json';

export type IntegrationCatalogStatus = 'active' | 'mock' | 'planned';

export type IntegrationFilterTab =
  | 'all'
  | 'ai-agents'
  | 'communication'
  | 'design'
  | 'productivity'
  | 'planned';

type IntegrationCategory = Exclude<IntegrationFilterTab, 'all' | 'planned'>;

export type WorkspaceIntegration = {
  readonly id: string;
  readonly name: string;
  readonly websiteUrl: string;
  readonly description: string;
  readonly status: IntegrationCatalogStatus;
  readonly filterTab: IntegrationCategory;
  readonly defaultConnected: boolean;
  readonly highlights?: readonly string[];
};

type WorkspaceIntegrationOptions = {
  readonly status?: IntegrationCatalogStatus;
  readonly defaultConnected?: boolean;
  readonly highlights?: readonly string[];
};

type IntegrationCatalogSeed = {
  readonly id: string;
  readonly name: string;
  readonly websiteUrl: string;
  readonly description: string;
  readonly filterTab: IntegrationCategory;
} & WorkspaceIntegrationOptions;

function workspaceIntegration(
  seed: IntegrationCatalogSeed
): WorkspaceIntegration {
  const {
    id,
    name,
    websiteUrl,
    description,
    filterTab,
    status,
    defaultConnected,
    highlights,
  } = seed;

  return {
    id,
    name,
    websiteUrl,
    description,
    filterTab,
    status: status ?? 'planned',
    defaultConnected: defaultConnected ?? false,
    ...(highlights ? { highlights } : {}),
  };
}

export const INTEGRATION_FILTER_TABS: ReadonlyArray<{
  readonly id: IntegrationFilterTab;
  readonly label: string;
}> = [
  { id: 'all', label: 'All integrations' },
  { id: 'ai-agents', label: 'AI agents' },
  { id: 'communication', label: 'Communication' },
  { id: 'design', label: 'Design & diagramming' },
  { id: 'productivity', label: 'Productivity' },
  { id: 'planned', label: 'Planned' },
];

export const WORKSPACE_INTEGRATIONS: readonly WorkspaceIntegration[] =
  integrationCatalogData.map((seed) =>
    workspaceIntegration(seed as IntegrationCatalogSeed)
  );

export function integrationStatusLabel(
  status: IntegrationCatalogStatus
): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'mock':
      return 'Mock UI';
    case 'planned':
      return 'Planned';
  }
}

export function filterWorkspaceIntegrations(
  items: readonly WorkspaceIntegration[],
  tab: IntegrationFilterTab,
  searchQuery: string
): WorkspaceIntegration[] {
  const normalizedSearch = searchQuery.trim().toLowerCase();

  return items.filter((item) => {
    const matchesTab =
      tab === 'all' ||
      (tab === 'planned' ? item.status === 'planned' : item.filterTab === tab);

    if (!matchesTab) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    const haystack =
      `${item.name} ${item.description} ${item.websiteUrl}`.toLowerCase();
    return haystack.includes(normalizedSearch);
  });
}

export function integrationExternalHref(websiteUrl: string): string {
  return websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`;
}
