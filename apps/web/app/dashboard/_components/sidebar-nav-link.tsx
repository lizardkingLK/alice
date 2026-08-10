'use client';

import Link from 'next/link';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import {
  SidebarMenuButton,
  SidebarMenuItem,
} from '@repo/ui/components/ui/sidebar';
import type { LucideIcon } from '@repo/ui/lib/icons';

type SidebarNavLinkProps = {
  readonly href: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly isActive: boolean;
  /** When true, truncate overflowing labels (favorites). */
  readonly truncateLabel?: boolean;
};

export function SidebarNavLink({
  href,
  label,
  icon: Icon,
  isActive,
  truncateLabel = false,
}: Readonly<SidebarNavLinkProps>) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={label}>
        <Link href={href}>
          <Icon />
          {truncateLabel ? (
            <TruncatedText className="min-w-0 flex-1">{label}</TruncatedText>
          ) : (
            <span>{label}</span>
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
