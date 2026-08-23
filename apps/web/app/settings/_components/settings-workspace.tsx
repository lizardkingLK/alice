'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Bell, Shield, SlidersHorizontal, UserRound } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import type { SettingsTab } from '@/lib/search-params';

const SETTINGS_NAV: ReadonlyArray<{
  readonly id: SettingsTab;
  readonly label: string;
  readonly href: string;
  readonly Icon: typeof UserRound;
}> = [
  {
    id: 'general',
    label: 'General',
    href: '/settings?tab=general',
    Icon: UserRound,
  },
  {
    id: 'security',
    label: 'Security',
    href: '/settings?tab=security',
    Icon: Shield,
  },
  {
    id: 'notifications',
    label: 'Notifications',
    href: '/settings?tab=notifications',
    Icon: Bell,
  },
  {
    id: 'preferences',
    label: 'Preferences',
    href: '/settings?tab=preferences',
    Icon: SlidersHorizontal,
  },
];

type SettingsWorkspaceProps = {
  readonly activeTab: SettingsTab;
  readonly children: ReactNode;
};

export function SettingsWorkspace({
  activeTab,
  children,
}: Readonly<SettingsWorkspaceProps>) {
  return (
    <div className="bg-background flex min-h-full flex-col md:flex-row">
      <aside className="border-border w-full shrink-0 border-b md:w-56 md:border-r md:border-b-0">
        <div className="px-4 py-5 sm:px-4">
          <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        </div>
        <nav aria-label="Settings sections" className="px-2 pb-4">
          <ul className="flex flex-col gap-0.5">
            {SETTINGS_NAV.map(({ id, label, href, Icon }) => {
              const isActive = activeTab === id;
              return (
                <li key={id}>
                  <Link
                    href={href}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-muted text-foreground font-medium'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    )}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="min-w-0 leading-snug">{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
