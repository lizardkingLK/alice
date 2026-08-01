/**
 * In-app roadmap content. Keep aligned with `docs/product/ROADMAP.md`.
 */
export type RoadmapItem = {
  readonly title: string;
  readonly description: string;
};

export type RoadmapSection = {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly items: readonly RoadmapItem[];
};

export const ROADMAP_NEAR_TERM: readonly string[] = [
  'SCM on the work item — branches, PRs, and builds in Development',
  'Natural-language search / filters for faster triage',
  'Slack / Teams notifications for board and backlog loops',
];

export const ROADMAP_SECTIONS: readonly RoadmapSection[] = [
  {
    id: 'ai',
    title: 'AI',
    summary:
      'Assist triage, writing, and status without replacing how teams already work.',
    items: [
      {
        title: 'Smart triage',
        description:
          'Suggest assignee, priority, sprint, and labels from title and description.',
      },
      {
        title: 'Natural-language backlog',
        description:
          'Ask for views such as blockers in this sprint older than five days.',
      },
      {
        title: 'Standup / status digests',
        description: 'Auto-summarize sprint progress, risks, and stale items.',
      },
      {
        title: 'Estimate assist',
        description: 'Story-point or hour suggestions from similar past work.',
      },
      {
        title: 'Duplicate / related detection',
        description: 'Surface near-duplicate or dependent work items.',
      },
      {
        title: 'Writing help',
        description:
          'Refine acceptance criteria and break epics into subtasks.',
      },
      {
        title: 'Meeting → work',
        description: 'Turn notes or transcripts into draft issues with links.',
      },
    ],
  },
  {
    id: 'integrations',
    title: 'Integrations',
    summary: 'Connect source control, chat, CI, calendar, and identity.',
    items: [
      {
        title: 'SCM (GitHub / GitLab)',
        description:
          'Branches, PRs, commits, and deploy status on the work item.',
      },
      {
        title: 'Chat (Slack / Teams)',
        description:
          'Create issues, sprint reminders, and mentions synced to comments.',
      },
      {
        title: 'CI/CD',
        description: 'Build, test, and deploy badges with failure deep-links.',
      },
      {
        title: 'Calendar',
        description: 'Sprint dates, release windows, and PTO vs capacity.',
      },
      {
        title: 'Identity (SSO / SCIM)',
        description: 'Enterprise provisioning under System user management.',
      },
      {
        title: 'Webhooks + public API',
        description: 'Outbound events and inbound sync for custom tools.',
      },
      {
        title: 'Import / export',
        description: 'Jira / Linear CSV or API migration paths.',
      },
    ],
  },
  {
    id: 'differentiation',
    title: 'Differentiation',
    summary:
      'Capabilities beyond generic automation overlays — capacity, goals, and trust.',
    items: [
      {
        title: 'Capacity & forecasting',
        description: 'Team velocity plus leave to warn about sprint overload.',
      },
      {
        title: 'Dependency graph',
        description: 'Cross-project blockers with critical path visibility.',
      },
      {
        title: 'Goals / OKRs',
        description: 'Link epics to outcomes, not only tickets.',
      },
      {
        title: 'Automation rules',
        description: 'No-code rules such as Done with no worklog → remind.',
      },
      {
        title: 'Audit & compliance',
        description: 'Change history, retention, and export for reviews.',
      },
    ],
  },
];
