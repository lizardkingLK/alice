import { getAccessibleProjectList } from '@/lib/projects/accessible-project-list';
import { filterActiveProjects } from '@/lib/projects/active-projects';
import { displayHandleFromEmail } from '@/app/profile/_helpers/profile-identity';
import { resolveHomeDisplayName } from '@/app/_components/home/resolve-home-display-name';
import {
  getAssignedCompletion,
  listAssignedWipItems,
  listUnreadNotifications,
} from '@/app/dashboard/_services/my-work-snapshot.reads.server';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import type { HomeLaunchpadBootstrap } from '@/app/_components/home/home-launchpad.types';

export async function getHomeLaunchpadBootstrap(options: {
  readonly userId: string;
  readonly email: string;
  readonly name?: string | null;
  readonly role?: string | null;
  readonly avatarUrl?: string | null;
  readonly coverUrl?: string | null;
}): Promise<HomeLaunchpadBootstrap> {
  const [projects, wipItems, unreadNotifications, completion] =
    await Promise.all([
      safeServerFetch(
        getAccessibleProjectList(options.userId),
        [],
        'fetch home launchpad projects'
      ),
      safeServerFetch(
        listAssignedWipItems(options.userId),
        [],
        'fetch home launchpad WIP'
      ),
      safeServerFetch(
        listUnreadNotifications(options.userId),
        [],
        'fetch home launchpad notifications'
      ),
      safeServerFetch(
        getAssignedCompletion(options.userId),
        { doneCount: 0, totalCount: 0, percent: 0 },
        'fetch home launchpad completion'
      ),
    ]);

  const active = filterActiveProjects(projects);

  return {
    name: resolveHomeDisplayName({
      name: options.name,
      email: options.email,
    }),
    handle: displayHandleFromEmail(options.email),
    email: options.email,
    role: options.role?.trim() || 'member',
    avatarUrl: options.avatarUrl ?? null,
    coverUrl: options.coverUrl ?? null,
    projects: active.map((project) => ({
      id: project.id,
      name: project.name,
      key: project.key ?? null,
      description: project.description?.trim() || null,
    })),
    wipItems,
    unreadNotifications,
    completion,
  };
}
