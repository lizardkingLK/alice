import type { LucideIcon } from '@repo/ui/lib/icons';
import {
  FolderKanban,
  LayoutDashboard,
  Sparkles,
  Users,
  ListTodo,
  Kanban,
  Timer,
  Settings,
} from '@repo/ui/lib/icons';
import {
  isAdmin,
  isAppRole,
  isManagerOrAdmin,
  type AppRole,
} from '@/lib/rbac/roles';

export type HomeQuickLink = {
  readonly id: string;
  readonly href: string;
  readonly title: string;
  readonly description: string;
  readonly icon: LucideIcon;
};

const OVERVIEW: HomeQuickLink = {
  id: 'overview',
  href: '/dashboard',
  title: 'Open Overview',
  description: 'Productivity dashboard and pinned charts',
  icon: LayoutDashboard,
};

const MY_WORK: HomeQuickLink = {
  id: 'my-work',
  href: '/member',
  title: 'My Work',
  description: 'Items assigned to you',
  icon: ListTodo,
};

const BOARD: HomeQuickLink = {
  id: 'board',
  href: '/board',
  title: 'Board',
  description: 'Kanban for your active sprint',
  icon: Kanban,
};

const ALICE: HomeQuickLink = {
  id: 'alice',
  href: '/chat',
  title: 'Chat with Alice',
  description: 'Ask Alice to help with workspace tasks',
  icon: Sparkles,
};

const PROJECTS: HomeQuickLink = {
  id: 'projects',
  href: '/projects',
  title: 'Create a project',
  description: 'Open Projects and add a new workspace',
  icon: FolderKanban,
};

const USERS: HomeQuickLink = {
  id: 'users',
  href: '/users',
  title: 'Manage users',
  description: 'Invite and update workspace members',
  icon: Users,
};

const SPRINTS: HomeQuickLink = {
  id: 'sprints',
  href: '/sprints',
  title: 'Sprints',
  description: 'Plan and review sprint cadence',
  icon: Timer,
};

const MANAGER: HomeQuickLink = {
  id: 'manager',
  href: '/manager',
  title: 'Teams',
  description: 'Organize people into teams',
  icon: Settings,
};

/** Role-scoped action cards for the signed-in home launchpad. */
export function getHomeQuickLinks(role: string): readonly HomeQuickLink[] {
  const appRole: AppRole | null = isAppRole(role) ? role : null;

  if (isAdmin(appRole)) {
    return [PROJECTS, USERS, OVERVIEW, ALICE];
  }

  if (isManagerOrAdmin(appRole)) {
    return [OVERVIEW, MANAGER, SPRINTS, BOARD];
  }

  return [OVERVIEW, MY_WORK, BOARD, ALICE];
}
