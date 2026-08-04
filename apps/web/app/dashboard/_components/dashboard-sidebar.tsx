'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FolderKanban,
  CircleDot,
  Settings,
  Users,
  Timer,
  ClipboardPenIcon,
  Kanban,
  ListTodo,
  User,
  CircleHelp,
  BookOpen,
  Map,
  type LucideIcon,
} from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@repo/ui/components/ui/sidebar';
import type { BoardDefaultsPreference } from '@/app/board/_helpers/board-defaults-storage';
import { useWorkspaceDefaultsNavPreference } from '@/app/board/_hooks/use-workspace-defaults-nav-preference';
import { buildWorkspaceNavHref } from '@/app/board/_services/board-defaults';
import { canAccessNavGroup, canAccessPath } from '@/lib/rbac/route-policy';
import type { AppRole } from '@/lib/rbac/roles';

type NavItem = {
  /** Pathname used for active matching (no query). */
  readonly path: string;
  readonly label: string;
  readonly icon: LucideIcon;
};

const PLATFORM_NAV: readonly NavItem[] = [
  { path: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { path: '/backlog', label: 'Backlog', icon: ListTodo },
  { path: '/board', label: 'Board', icon: Kanban },
  { path: '/work-items', label: 'Work Items', icon: ClipboardPenIcon },
  { path: '/member', label: 'My Work', icon: CircleDot },
];

const SYSTEM_NAV: readonly NavItem[] = [
  { path: '/users', label: 'Users', icon: Users },
];

const PROJECTS_NAV: readonly NavItem[] = [
  { path: '/projects', label: 'Projects', icon: FolderKanban },
];

const SPRINTS_NAV: readonly NavItem[] = [
  { path: '/sprints', label: 'Sprints', icon: Timer },
];

const HELP_NAV: readonly NavItem[] = [
  { path: '/help', label: 'Help', icon: CircleHelp },
  { path: '/docs', label: 'Docs', icon: BookOpen },
  { path: '/roadmap', label: 'Roadmap', icon: Map },
];

function isNavActive(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

function SidebarNavItems({
  items,
  pathname,
  preference,
}: Readonly<{
  items: readonly NavItem[];
  pathname: string;
  preference: BoardDefaultsPreference | null;
}>) {
  return (
    <SidebarMenu>
      {items.map(({ path, label, icon: Icon }) => (
        <SidebarMenuItem key={path}>
          <SidebarMenuButton
            asChild
            isActive={isNavActive(pathname, path)}
            tooltip={label}
          >
            <Link href={buildWorkspaceNavHref(path, preference)}>
              <Icon />
              <span>{label}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

function SidebarNavGroup({
  label,
  items,
  pathname,
  preference,
}: Readonly<{
  label: string;
  items: readonly NavItem[];
  pathname: string;
  preference: BoardDefaultsPreference | null;
}>) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarNavItems
          items={items}
          pathname={pathname}
          preference={preference}
        />
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

type DashboardSidebarProps = {
  readonly userId?: string | null;
  /** App role from `public.users.role`; null hides role-gated nav groups. */
  readonly role?: AppRole | null;
};

export function DashboardSidebar({
  userId = null,
  role = null,
}: Readonly<DashboardSidebarProps>) {
  const pathname = usePathname();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';
  const preference = useWorkspaceDefaultsNavPreference(userId);
  const showSystem = canAccessNavGroup(role, 'system');
  const showProjects = canAccessNavGroup(role, 'projects');
  const showSprints = canAccessPath(role, '/sprints');
  const projectsNavItems = showSprints
    ? [...PROJECTS_NAV, ...SPRINTS_NAV]
    : [...PROJECTS_NAV];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-sidebar-border flex h-16 shrink-0 items-center overflow-hidden border-b px-2">
        <Link
          href="/"
          className={cn(
            'flex h-16 flex-col justify-center text-base font-semibold tracking-tight whitespace-nowrap',
            'transition-[opacity,max-width] duration-200 ease-out',
            isCollapsed && 'pointer-events-none max-w-0 opacity-0'
          )}
        >
          Jira Teams
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarNavGroup
          label="Platform"
          items={PLATFORM_NAV}
          pathname={pathname}
          preference={preference}
        />
        {showSystem ? (
          <SidebarNavGroup
            label="System"
            items={SYSTEM_NAV}
            pathname={pathname}
            preference={preference}
          />
        ) : null}
        {showProjects ? (
          <SidebarNavGroup
            label="Projects"
            items={projectsNavItems}
            pathname={pathname}
            preference={preference}
          />
        ) : null}

        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isNavActive(pathname, '/profile')}
                  tooltip="Profile"
                >
                  <Link href="/profile">
                    <User />
                    <span>Profile</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton disabled tooltip="Coming soon">
                  <Settings />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarNavGroup
          label="Help"
          items={HELP_NAV}
          pathname={pathname}
          preference={preference}
        />
      </SidebarContent>
    </Sidebar>
  );
}
