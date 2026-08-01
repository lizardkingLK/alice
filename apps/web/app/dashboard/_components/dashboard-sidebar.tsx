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

type NavItem = {
  readonly href: string;
  readonly label: string;
  readonly icon: LucideIcon;
};

const PLATFORM_NAV: readonly NavItem[] = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/backlog', label: 'Backlog', icon: ListTodo },
  { href: '/board', label: 'Board', icon: Kanban },
  { href: '/work-items', label: 'Work Items', icon: ClipboardPenIcon },
  { href: '/member', label: 'My Work', icon: CircleDot },
];

const SYSTEM_NAV: readonly NavItem[] = [
  { href: '/users', label: 'Users', icon: Users },
];

const PROJECTS_NAV: readonly NavItem[] = [
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/sprints', label: 'Sprints', icon: Timer },
];

const HELP_NAV: readonly NavItem[] = [
  { href: '/help', label: 'Help', icon: CircleHelp },
  { href: '/docs', label: 'Docs', icon: BookOpen },
  { href: '/roadmap', label: 'Roadmap', icon: Map },
];

function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarNavItems({
  items,
  pathname,
}: Readonly<{ items: readonly NavItem[]; pathname: string }>) {
  return (
    <SidebarMenu>
      {items.map(({ href, label, icon: Icon }) => (
        <SidebarMenuItem key={href}>
          <SidebarMenuButton asChild isActive={isNavActive(pathname, href)}>
            <Link href={href}>
              <Icon />
              <span>{label}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

export function DashboardSidebar() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

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
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarNavItems items={PLATFORM_NAV} pathname={pathname} />
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>System</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarNavItems items={SYSTEM_NAV} pathname={pathname} />
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Projects</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarNavItems items={PROJECTS_NAV} pathname={pathname} />
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isNavActive(pathname, '/profile')}
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

        <SidebarGroup>
          <SidebarGroupLabel>Help</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarNavItems items={HELP_NAV} pathname={pathname} />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
