import type { DocsIndexEntry } from '@/lib/docs/docs-shared';

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
};
