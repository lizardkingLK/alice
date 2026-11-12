import type { ChatModelOption } from '@repo/types';
import type { DocsIndexEntry } from '@/lib/docs/docs-shared';
import type {
  HomeLaunchpadCompletion,
  HomeLaunchpadNotification,
  HomeLaunchpadWorkItem,
} from '@/app/_components/home/home-launchpad.types';
import type { PreferredChatAssistantBootstrap } from '@/app/chat/_helpers/chat-assistant-identity';

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
  /** SSR chat models for Overview Alice (avoids client flash of empty chat). */
  readonly chatModels: readonly ChatModelOption[];
  /**
   * Active agents for Overview Alice personality chevrons.
   * Cleared when `chatModels` is empty (no-models gate hides personality).
   */
  readonly chatAgents: readonly PreferredChatAssistantBootstrap[];
  /** Preferred / default agent id within `chatAgents`. */
  readonly preferredChatAgentId: string | null;
};
