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

const INTEGRATION_CATALOG_SEEDS: readonly IntegrationCatalogSeed[] = [
  {
    id: 'alice-gemini',
    name: 'Google Gemini',
    websiteUrl: 'ai.google.dev',
    description:
      'Power Alice Chat with Gemini models, function calling, and workspace-aware project context.',
    filterTab: 'ai-agents',
    status: 'mock',
    defaultConnected: true,
    highlights: [
      'Shared model list with the chat sidebar',
      'Function calling for projects, sprints, and work items',
      'Workspace-level model default (planned)',
    ],
  },
  {
    id: 'coderabbit',
    name: 'CodeRabbit',
    websiteUrl: 'coderabbit.ai',
    description:
      'AI code review summaries and suggested fixes linked to pull requests on work items.',
    filterTab: 'ai-agents',
  },
  {
    id: 'cursor',
    name: 'Cursor',
    websiteUrl: 'cursor.com',
    description:
      'Connect Cursor agents for in-IDE planning sessions tied to Alice epics and stories.',
    filterTab: 'ai-agents',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    websiteUrl: 'openai.com',
    description:
      'Optional GPT models alongside Gemini for Alice Chat and future automations.',
    filterTab: 'ai-agents',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    websiteUrl: 'anthropic.com',
    description:
      'Claude models for long-context planning sessions and spec reviews inside Alice.',
    filterTab: 'ai-agents',
  },
  {
    id: 'slack',
    name: 'Slack',
    websiteUrl: 'slack.com',
    description:
      'Post work-item updates, sprint summaries, and @-mention Alice in team channels.',
    filterTab: 'communication',
    status: 'mock',
    highlights: [
      'Workspace bot installation',
      'Channel routing rules',
      'Thread summaries (planned)',
    ],
  },
  {
    id: 'intercom',
    name: 'Intercom',
    websiteUrl: 'intercom.com',
    description:
      'Route customer conversations into Alice work items and sprint follow-ups.',
    filterTab: 'communication',
  },
  {
    id: 'loom',
    name: 'Loom',
    websiteUrl: 'loom.com',
    description:
      'Attach async video updates to work items and sprint reviews.',
    filterTab: 'communication',
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    websiteUrl: 'mailchimp.com',
    description:
      'Sync release announcements and stakeholder comms with sprint milestones.',
    filterTab: 'communication',
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    websiteUrl: 'teams.microsoft.com',
    description:
      'Enterprise chat parity with Slack for notifications and Alice mentions.',
    filterTab: 'communication',
  },
  {
    id: 'figma',
    name: 'Figma',
    websiteUrl: 'figma.com',
    description:
      'Link Figma files and prototypes to stories for design–dev handoff inside Alice.',
    filterTab: 'design',
  },
  {
    id: 'eraser',
    name: 'Eraser',
    websiteUrl: 'eraser.io',
    description:
      'Attach cloud architecture and flow diagrams to epics; open Eraser boards from work items.',
    filterTab: 'design',
  },
  {
    id: 'miro',
    name: 'Miro',
    websiteUrl: 'miro.com',
    description:
      'Embed whiteboards for discovery workshops and link boards to epics.',
    filterTab: 'design',
  },
  {
    id: 'asana',
    name: 'Asana',
    websiteUrl: 'asana.com',
    description:
      'Import projects and tasks for teams evaluating a move to Alice.',
    filterTab: 'productivity',
  },
  {
    id: 'trello',
    name: 'Trello',
    websiteUrl: 'trello.com',
    description:
      'Migrate boards and cards into Alice work items with status mapping.',
    filterTab: 'productivity',
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    websiteUrl: 'dropbox.com',
    description:
      'Link shared folders and files as attachments on epics and stories.',
    filterTab: 'productivity',
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    websiteUrl: 'drive.google.com',
    description:
      'Attach Docs and Sheets from Drive directly to work-item descriptions.',
    filterTab: 'productivity',
  },
  {
    id: 'zapier',
    name: 'Zapier',
    websiteUrl: 'zapier.com',
    description:
      'Automate Alice events with thousands of SaaS triggers and actions.',
    filterTab: 'productivity',
  },
  {
    id: 'linear',
    name: 'Linear',
    websiteUrl: 'linear.app',
    description:
      'Bi-directional issue sync for teams migrating from Linear to Alice.',
    filterTab: 'productivity',
  },
  {
    id: 'notion',
    name: 'Notion',
    websiteUrl: 'notion.so',
    description:
      'Pull spec pages into work-item descriptions and keep docs in sync.',
    filterTab: 'productivity',
  },
  {
    id: 'github-copilot',
    name: 'GitHub Copilot',
    websiteUrl: 'github.com/features/copilot',
    description:
      'Suggest PR links and code context on tasks (extends project GitHub).',
    filterTab: 'productivity',
  },
  {
    id: 'jira-cloud',
    name: 'Jira Cloud',
    websiteUrl: 'atlassian.com/software/jira',
    description:
      'Smart import and duplicate detection (extends project Jira integration).',
    filterTab: 'productivity',
  },
];

export const WORKSPACE_INTEGRATIONS: readonly WorkspaceIntegration[] =
  INTEGRATION_CATALOG_SEEDS.map(workspaceIntegration);

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
