import type { ComponentType, SVGProps } from 'react';
import {
  Bot,
  Boxes,
  FolderKanban,
  Kanban,
  LayoutDashboard,
  ListTodo,
  MessageSquare,
  PenTool,
  Sparkles,
  Timer,
  UserPlus,
  Workflow,
} from '@repo/ui/lib/icons';

type FlowIcon = ComponentType<SVGProps<SVGSVGElement>>;

export type AboutFlowPhase = {
  readonly step: string;
  readonly title: string;
  readonly description: string;
  readonly detail: string;
  readonly icon: FlowIcon;
};

export type AboutIntegrationSpotlight = {
  readonly name: string;
  readonly blurb: string;
  readonly icon: FlowIcon;
};

/** Alice delivery loop — expands the home “How it works” story for About. */
export const ABOUT_FLOW_PHASES: readonly AboutFlowPhase[] = [
  {
    step: '01',
    title: 'Create a project',
    description:
      'Stand up a workspace for a team or initiative with a clear key, owner, and scope.',
    detail: 'One place for ownership and access',
    icon: FolderKanban,
  },
  {
    step: '02',
    title: 'Assign members',
    description:
      'Invite the people who need the work — owners, managers, and contributors — without opening the whole domain.',
    detail: 'Right people on the right projects',
    icon: UserPlus,
  },
  {
    step: '03',
    title: 'Build the backlog',
    description:
      'Capture work items, set priorities, and shape what should ship next before you commit.',
    detail: 'Prioritize before you sprint',
    icon: ListTodo,
  },
  {
    step: '04',
    title: 'Plan a sprint',
    description:
      'Pull the next slice of work into a time-boxed sprint and align on goals the team can finish.',
    detail: 'Commit to what you can deliver',
    icon: Timer,
  },
  {
    step: '05',
    title: 'Deliver on the board',
    description:
      'Move items across columns, update status as you go, and keep blockers visible for the whole team.',
    detail: 'Day-to-day delivery in view',
    icon: Kanban,
  },
  {
    step: '06',
    title: 'Review on the dashboard',
    description:
      'Check progress, reports, and what’s next so planning and delivery stay connected.',
    detail: 'Close the loop with visibility',
    icon: LayoutDashboard,
  },
] as const;

export const ABOUT_INTEGRATION_SPOTLIGHTS: readonly AboutIntegrationSpotlight[] =
  [
    {
      name: 'Google Gemini',
      blurb:
        'Ask Alice about projects, sprints, and work with workspace-aware chat.',
      icon: Sparkles,
    },
    {
      name: 'SpaceXAI',
      blurb: 'Bring Grok-class models into the same Alice Chat sidebar.',
      icon: Bot,
    },
    {
      name: 'Jira Cloud',
      blurb:
        'Import and sync work without leaving your Alice project settings.',
      icon: Workflow,
    },
    {
      name: 'Slack',
      blurb:
        'Keep notifications and mentions close to where the team already talks.',
      icon: MessageSquare,
    },
    {
      name: 'Figma',
      blurb:
        'Link designs to stories so handoff stays attached to the work item.',
      icon: PenTool,
    },
    {
      name: 'GitHub',
      blurb: 'Connect pull requests and delivery context to the board.',
      icon: Boxes,
    },
  ] as const;
