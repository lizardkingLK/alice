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

function workspaceIntegration(
  id: string,
  name: string,
  websiteUrl: string,
  description: string,
  filterTab: IntegrationCategory,
  options: WorkspaceIntegrationOptions = {}
): WorkspaceIntegration {
  return {
    id,
    name,
    websiteUrl,
    description,
    filterTab,
    status: options.status ?? 'planned',
    defaultConnected: options.defaultConnected ?? false,
    ...(options.highlights ? { highlights: options.highlights } : {}),
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

export const WORKSPACE_INTEGRATIONS: readonly WorkspaceIntegration[] = [
  workspaceIntegration(
    'alice-gemini',
    'Google Gemini',
    'ai.google.dev',
    'Power Alice Chat with Gemini models, function calling, and workspace-aware project context.',
    'ai-agents',
    {
      status: 'mock',
      defaultConnected: true,
      highlights: [
        'Shared model list with the chat sidebar',
        'Function calling for projects, sprints, and work items',
        'Workspace-level model default (planned)',
      ],
    }
  ),
  workspaceIntegration(
    'coderabbit',
    'CodeRabbit',
    'coderabbit.ai',
    'AI code review summaries and suggested fixes linked to pull requests on work items.',
    'ai-agents'
  ),
  workspaceIntegration(
    'cursor',
    'Cursor',
    'cursor.com',
    'Connect Cursor agents for in-IDE planning sessions tied to Alice epics and stories.',
    'ai-agents'
  ),
  workspaceIntegration(
    'openai',
    'OpenAI',
    'openai.com',
    'Optional GPT models alongside Gemini for Alice Chat and future automations.',
    'ai-agents'
  ),
  workspaceIntegration(
    'anthropic',
    'Anthropic',
    'anthropic.com',
    'Claude models for long-context planning sessions and spec reviews inside Alice.',
    'ai-agents'
  ),
  workspaceIntegration(
    'slack',
    'Slack',
    'slack.com',
    'Post work-item updates, sprint summaries, and @-mention Alice in team channels.',
    'communication',
    {
      status: 'mock',
      highlights: [
        'Workspace bot installation',
        'Channel routing rules',
        'Thread summaries (planned)',
      ],
    }
  ),
  workspaceIntegration(
    'intercom',
    'Intercom',
    'intercom.com',
    'Route customer conversations into Alice work items and sprint follow-ups.',
    'communication'
  ),
  workspaceIntegration(
    'loom',
    'Loom',
    'loom.com',
    'Attach async video updates to work items and sprint reviews.',
    'communication'
  ),
  workspaceIntegration(
    'mailchimp',
    'Mailchimp',
    'mailchimp.com',
    'Sync release announcements and stakeholder comms with sprint milestones.',
    'communication'
  ),
  workspaceIntegration(
    'teams',
    'Microsoft Teams',
    'teams.microsoft.com',
    'Enterprise chat parity with Slack for notifications and Alice mentions.',
    'communication'
  ),
  workspaceIntegration(
    'figma',
    'Figma',
    'figma.com',
    'Link Figma files and prototypes to stories for design–dev handoff inside Alice.',
    'design'
  ),
  workspaceIntegration(
    'eraser',
    'Eraser',
    'eraser.io',
    'Attach cloud architecture and flow diagrams to epics; open Eraser boards from work items.',
    'design'
  ),
  workspaceIntegration(
    'miro',
    'Miro',
    'miro.com',
    'Embed whiteboards for discovery workshops and link boards to epics.',
    'design'
  ),
  workspaceIntegration(
    'asana',
    'Asana',
    'asana.com',
    'Import projects and tasks for teams evaluating a move to Alice.',
    'productivity'
  ),
  workspaceIntegration(
    'trello',
    'Trello',
    'trello.com',
    'Migrate boards and cards into Alice work items with status mapping.',
    'productivity'
  ),
  workspaceIntegration(
    'dropbox',
    'Dropbox',
    'dropbox.com',
    'Link shared folders and files as attachments on epics and stories.',
    'productivity'
  ),
  workspaceIntegration(
    'google-drive',
    'Google Drive',
    'drive.google.com',
    'Attach Docs and Sheets from Drive directly to work-item descriptions.',
    'productivity'
  ),
  workspaceIntegration(
    'zapier',
    'Zapier',
    'zapier.com',
    'Automate Alice events with thousands of SaaS triggers and actions.',
    'productivity'
  ),
  workspaceIntegration(
    'linear',
    'Linear',
    'linear.app',
    'Bi-directional issue sync for teams migrating from Linear to Alice.',
    'productivity'
  ),
  workspaceIntegration(
    'notion',
    'Notion',
    'notion.so',
    'Pull spec pages into work-item descriptions and keep docs in sync.',
    'productivity'
  ),
  workspaceIntegration(
    'github-copilot',
    'GitHub Copilot',
    'github.com/features/copilot',
    'Suggest PR links and code context on tasks (extends project GitHub).',
    'productivity'
  ),
  workspaceIntegration(
    'jira-cloud',
    'Jira Cloud',
    'atlassian.com/software/jira',
    'Smart import and duplicate detection (extends project Jira integration).',
    'productivity'
  ),
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
