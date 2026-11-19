import type { Tables } from '@repo/types';

export type HomeLaunchpadProject = {
  readonly id: string;
  readonly name: string;
  readonly key: string | null;
  readonly description: string | null;
};

export type HomeLaunchpadWorkItem = {
  readonly id: string;
  readonly title: string;
  readonly slug: string | null;
  readonly status: Tables<'work_items'>['status'];
  readonly projectKey: string | null;
  readonly updatedAt: string;
};

export type HomeLaunchpadNotification = {
  readonly id: string;
  readonly message: string;
  readonly type: Tables<'notifications'>['type'];
  readonly relatedItemId: string | null;
  readonly createdAt: string;
};

export type HomeLaunchpadCompletion = {
  /** Assigned active items currently Done. */
  readonly doneCount: number;
  /** All assigned active items (open + done). */
  readonly totalCount: number;
  /** 0–100 rounded completion share. */
  readonly percent: number;
};

export type HomeLaunchpadBootstrap = {
  readonly name: string;
  readonly handle: string;
  readonly email: string;
  readonly role: string;
  readonly avatarUrl: string | null;
  readonly coverUrl: string | null;
  readonly projects: readonly HomeLaunchpadProject[];
  readonly wipItems: readonly HomeLaunchpadWorkItem[];
  readonly unreadNotifications: readonly HomeLaunchpadNotification[];
  readonly completion: HomeLaunchpadCompletion;
};
