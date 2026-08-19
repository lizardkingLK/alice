'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings, User, ChevronRight } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@repo/ui/components/ui/collapsible';
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
import { useFavorites } from '@/lib/favorites/use-favorites';
import {
  readFavoritesSidebarOpen,
  writeFavoritesSidebarOpen,
} from '@/lib/favorites/favorites-sidebar-storage';
import { resolveFavoriteNavIcon } from '@/lib/favorites/favorite-nav-icon';
import {
  HELP_NAV,
  PLATFORM_NAV,
  PROJECTS_NAV,
  SPRINTS_NAV,
  SYSTEM_NAV,
  type DashboardNavItem,
} from '@/lib/dashboard/nav-registry';
import { canAccessNavGroup, canAccessPath } from '@/lib/rbac/route-policy';
import type { AppRole } from '@/lib/rbac/roles';
import { SidebarNavLink } from '@/app/dashboard/_components/sidebar-nav-link';

function isNavActive(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

function SidebarNavItems({
  items,
  pathname,
  preference,
}: Readonly<{
  items: readonly DashboardNavItem[];
  pathname: string;
  preference: BoardDefaultsPreference | null;
}>) {
  return (
    <SidebarMenu>
      {items.map(({ path, label, icon }) => (
        <SidebarNavLink
          key={path}
          href={buildWorkspaceNavHref(path, preference)}
          label={label}
          icon={icon}
          isActive={isNavActive(pathname, path)}
        />
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
  items: readonly DashboardNavItem[];
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

function FavoritesSidebarGroup({
  favorites,
  pathname,
  userId,
}: Readonly<{
  favorites: ReturnType<typeof useFavorites>['favorites'];
  pathname: string;
  userId: string | null | undefined;
}>) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setOpen(readFavoritesSidebarOpen(userId));
  }, [userId]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    writeFavoritesSidebarOpen(userId, next);
  };

  return (
    <SidebarGroup>
      <Collapsible open={open} onOpenChange={handleOpenChange}>
        <SidebarGroupLabel asChild>
          <CollapsibleTrigger
            className="hover:bg-sidebar-accent flex w-full cursor-pointer items-center justify-between gap-2 rounded-md"
            aria-label={open ? 'Collapse Favorites' : 'Expand Favorites'}
          >
            <span>Favorites</span>
            <ChevronRight
              className={cn(
                'size-3.5 shrink-0 transition-transform duration-200',
                open && 'rotate-90'
              )}
            />
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {favorites.map((favorite) => (
                <SidebarNavLink
                  key={favorite.id}
                  href={favorite.pathname}
                  label={favorite.label}
                  icon={resolveFavoriteNavIcon(favorite.pathname)}
                  isActive={isNavActive(pathname, favorite.pathname)}
                  truncateLabel
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </Collapsible>
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
  const { favorites } = useFavorites(userId);
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
          Alice
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarNavGroup
          label="Platform"
          items={PLATFORM_NAV}
          pathname={pathname}
          preference={preference}
        />

        {favorites.length > 0 ? (
          <FavoritesSidebarGroup
            favorites={favorites}
            pathname={pathname}
            userId={userId}
          />
        ) : null}

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
