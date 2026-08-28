import {
  BookOpen,
  CircleDot,
  CircleHelp,
  ClipboardPenIcon,
  FolderKanban,
  Kanban,
  Layers,
  LayoutDashboard,
  ListTodo,
  Map,
  Settings,
  Sparkles,
  Timer,
  User,
  Users,
  type LucideIcon,
} from '@repo/ui/lib/icons';
import { normalizeFavoritePathname } from '@/lib/favorites/favorites-storage';

export type DashboardNavItem = {
  /** Pathname used for active matching and favorite icon lookup (no query). */
  readonly path: string;
  readonly label: string;
  readonly icon: LucideIcon;
};

/**
 * Canonical dashboard nav registry — sidebar groups and favorite icons share
 * this path → icon (and label) map so they cannot drift.
 */
export const PLATFORM_NAV: readonly DashboardNavItem[] = [
  { path: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { path: '/backlog', label: 'Backlog', icon: ListTodo },
  { path: '/board', label: 'Board', icon: Kanban },
  { path: '/work-items', label: 'Work Items', icon: ClipboardPenIcon },
  { path: '/member', label: 'My Work', icon: CircleDot },
  { path: '/chat', label: 'Alice', icon: Sparkles },
  { path: '/views', label: 'Views', icon: Layers },
];

export const SYSTEM_NAV: readonly DashboardNavItem[] = [
  { path: '/users', label: 'Users', icon: Users },
];

export const PROJECTS_NAV: readonly DashboardNavItem[] = [
  { path: '/projects', label: 'Projects', icon: FolderKanban },
];

export const SPRINTS_NAV: readonly DashboardNavItem[] = [
  { path: '/sprints', label: 'Sprints', icon: Timer },
];

export const HELP_NAV: readonly DashboardNavItem[] = [
  { path: '/help', label: 'Help', icon: CircleHelp },
  { path: '/docs', label: 'Docs', icon: BookOpen },
  { path: '/roadmap', label: 'Roadmap', icon: Map },
];

/** Extra path→icon pairs used by favorites but not primary sidebar links. */
const EXTRA_FAVORITE_NAV_ICONS: readonly DashboardNavItem[] = [
  { path: '/profile', label: 'Profile', icon: User },
  { path: '/manager', label: 'Manager', icon: Settings },
];

const ALL_FAVORITE_NAV_ICONS: readonly DashboardNavItem[] = [
  ...PLATFORM_NAV,
  ...SYSTEM_NAV,
  ...PROJECTS_NAV,
  ...SPRINTS_NAV,
  ...HELP_NAV,
  ...EXTRA_FAVORITE_NAV_ICONS,
];

/** Fallback when pathname does not match a known area. */
export const DEFAULT_FAVORITE_NAV_ICON: LucideIcon = CircleDot;

/**
 * Resolve the sidebar icon for a favorited pathname (query already stripped).
 * Longest path prefix wins.
 */
export function resolveFavoriteNavIcon(pathname: string): LucideIcon {
  const normalized = normalizeFavoritePathname(pathname);
  const match = [...ALL_FAVORITE_NAV_ICONS]
    .sort((a, b) => b.path.length - a.path.length)
    .find(
      ({ path }) => normalized === path || normalized.startsWith(`${path}/`)
    );

  return match?.icon ?? DEFAULT_FAVORITE_NAV_ICON;
}
