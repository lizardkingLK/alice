'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FolderKanban,
  CircleDot,
  Settings,
  Users,
  Music,
  Timer,
  Files,
  Code,
} from 'lucide-react';
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

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/sprints', label: 'Sprints', icon: Timer },
  { href: '/attributes', label: 'Attributes', icon: Code },
  { href: '/files', label: 'Files', icon: Files },
  { href: '/instruments', label: 'Instruments', icon: Music },
  { href: '/member', label: 'My Work', icon: CircleDot },
  { href: '/manager', label: 'Team', icon: Users },
] as const;

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
            <SidebarMenu>
              {navItems.map(({ href, label, icon: Icon }) => {
                const isActive =
                  pathname === href || pathname.startsWith(`${href}/`);

                return (
                  <SidebarMenuItem key={label}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={href}>
                        <Icon />
                        <span>{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton disabled tooltip="Coming soon">
                  <Settings />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
