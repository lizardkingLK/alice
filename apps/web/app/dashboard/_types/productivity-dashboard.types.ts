import type { DocsIndexEntry } from '@/lib/docs/docs-shared';
import type {
  HomeLaunchpadCompletion,
  HomeLaunchpadNotification,
  HomeLaunchpadWorkItem,
} from '@/app/_components/home/home-launchpad.types';

export type MyWorkOverviewStats = {
  readonly assignedOpen: number;
  readonly pendingStories: number;
  readonly inProgress: number;
};

export type ProductivityProjectSummary = {
  readonly id: string;
  readonly name: string;
  readonly key: string | null;
};

export type ProductivityDashboardBootstrap = {
  readonly myWork: MyWorkOverviewStats;
  readonly projects: readonly ProductivityProjectSummary[];
  readonly docs: readonly DocsIndexEntry[];
  readonly wipItems: readonly HomeLaunchpadWorkItem[];
  readonly unreadNotifications: readonly HomeLaunchpadNotification[];
  readonly completion: HomeLaunchpadCompletion;
};
