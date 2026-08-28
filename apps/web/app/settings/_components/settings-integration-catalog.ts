export type IntegrationCatalogStatus = 'active' | 'mock' | 'planned';

export type IntegrationFilterTab =
  'all' | 'ai-agents' | 'communication' | 'design' | 'productivity' | 'planned';

export type WorkspaceIntegration = {
  readonly id: string;
  readonly name: string;
  readonly websiteUrl: string;
  readonly description: string;
  readonly status: IntegrationCatalogStatus;
  readonly filterTab: Exclude<IntegrationFilterTab, 'all' | 'planned'>;
  readonly defaultConnected: boolean;
  readonly highlights?: readonly string[];
};

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

export const WORKSPACE_INTEGRATIONS: readonly WorkspaceIntegration[] = [
  {
    id: 'alice-gemini',
    name: 'Google Gemini',
    websiteUrl: 'ai.google.dev',
    description:
      'Power Alice Chat with Gemini models, function calling, and workspace-aware project context.',
    status: 'mock',
    filterTab: 'ai-agents',
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
    status: 'planned',
    filterTab: 'ai-agents',
    defaultConnected: false,
  },
  {
    id: 'cursor',
    name: 'Cursor',
    websiteUrl: 'cursor.com',
    description:
      'Connect Cursor agents for in-IDE planning sessions tied to Alice epics and stories.',
    status: 'planned',
    filterTab: 'ai-agents',
    defaultConnected: false,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    websiteUrl: 'openai.com',
    description:
      'Optional GPT models alongside Gemini for Alice Chat and future automations.',
    status: 'planned',
    filterTab: 'ai-agents',
    defaultConnected: false,
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    websiteUrl: 'anthropic.com',
    description:
      'Claude models for long-context planning sessions and spec reviews inside Alice.',
    status: 'planned',
    filterTab: 'ai-agents',
    defaultConnected: false,
  },
  {
    id: 'slack',
    name: 'Slack',
    websiteUrl: 'slack.com',
    description:
      'Post work-item updates, sprint summaries, and @-mention Alice in team channels.',
    status: 'mock',
    filterTab: 'communication',
    defaultConnected: false,
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
    status: 'planned',
    filterTab: 'communication',
    defaultConnected: false,
  },
  {
    id: 'loom',
    name: 'Loom',
    websiteUrl: 'loom.com',
    description: 'Attach async video updates to work items and sprint reviews.',
    status: 'planned',
    filterTab: 'communication',
    defaultConnected: false,
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    websiteUrl: 'mailchimp.com',
    description:
      'Sync release announcements and stakeholder comms with sprint milestones.',
    status: 'planned',
    filterTab: 'communication',
    defaultConnected: false,
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    websiteUrl: 'teams.microsoft.com',
    description:
      'Enterprise chat parity with Slack for notifications and Alice mentions.',
    status: 'planned',
    filterTab: 'communication',
    defaultConnected: false,
  },
  {
    id: 'figma',
    name: 'Figma',
    websiteUrl: 'figma.com',
    description:
      'Link Figma files and prototypes to stories for design–dev handoff inside Alice.',
    status: 'planned',
    filterTab: 'design',
    defaultConnected: false,
  },
  {
    id: 'eraser',
    name: 'Eraser',
    websiteUrl: 'eraser.io',
    description:
      'Attach cloud architecture and flow diagrams to epics; open Eraser boards from work items.',
    status: 'planned',
    filterTab: 'design',
    defaultConnected: false,
  },
  {
    id: 'miro',
    name: 'Miro',
    websiteUrl: 'miro.com',
    description:
      'Embed whiteboards for discovery workshops and link boards to epics.',
    status: 'planned',
    filterTab: 'design',
    defaultConnected: false,
  },
  {
    id: 'asana',
    name: 'Asana',
    websiteUrl: 'asana.com',
    description:
      'Import projects and tasks for teams evaluating a move to Alice.',
    status: 'planned',
    filterTab: 'productivity',
    defaultConnected: false,
  },
  {
    id: 'trello',
    name: 'Trello',
    websiteUrl: 'trello.com',
    description:
      'Migrate boards and cards into Alice work items with status mapping.',
    status: 'planned',
    filterTab: 'productivity',
    defaultConnected: false,
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    websiteUrl: 'dropbox.com',
    description:
      'Link shared folders and files as attachments on epics and stories.',
    status: 'planned',
    filterTab: 'productivity',
    defaultConnected: false,
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    websiteUrl: 'drive.google.com',
    description:
      'Attach Docs and Sheets from Drive directly to work-item descriptions.',
    status: 'planned',
    filterTab: 'productivity',
    defaultConnected: false,
  },
  {
    id: 'zapier',
    name: 'Zapier',
    websiteUrl: 'zapier.com',
    description:
      'Automate Alice events with thousands of SaaS triggers and actions.',
    status: 'planned',
    filterTab: 'productivity',
    defaultConnected: false,
  },
  {
    id: 'linear',
    name: 'Linear',
    websiteUrl: 'linear.app',
    description:
      'Bi-directional issue sync for teams migrating from Linear to Alice.',
    status: 'planned',
    filterTab: 'productivity',
    defaultConnected: false,
  },
  {
    id: 'notion',
    name: 'Notion',
    websiteUrl: 'notion.so',
    description:
      'Pull spec pages into work-item descriptions and keep docs in sync.',
    status: 'planned',
    filterTab: 'productivity',
    defaultConnected: false,
  },
  {
    id: 'github-copilot',
    name: 'GitHub Copilot',
    websiteUrl: 'github.com/features/copilot',
    description:
      'Suggest PR links and code context on tasks (extends project GitHub).',
    status: 'planned',
    filterTab: 'productivity',
    defaultConnected: false,
  },
  {
    id: 'jira-cloud',
    name: 'Jira Cloud',
    websiteUrl: 'atlassian.com/software/jira',
    description:
      'Smart import and duplicate detection (extends project Jira integration).',
    status: 'planned',
    filterTab: 'productivity',
    defaultConnected: false,
  },
];

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
