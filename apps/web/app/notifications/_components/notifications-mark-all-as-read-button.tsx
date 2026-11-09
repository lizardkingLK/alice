'use client';

import type { MouseEvent } from 'react';
import { CheckCheck } from '@repo/ui/lib/icons';
import { Button } from '@repo/ui/components/ui/button';

export function NotificationsMarkAllAsReadButton({
  unreadCount,
  onMarkAllAsRead,
  stopPropagation = false,
}: Readonly<{
  unreadCount: number;
  onMarkAllAsRead: () => void;
  /** Dropdown menus need this so the panel stays open while marking. */
  stopPropagation?: boolean;
}>) {
  if (unreadCount <= 0) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="text-primary hover:text-primary/80 h-auto gap-1 px-2 py-1 text-xs font-medium"
      onClick={(event: MouseEvent) => {
        if (stopPropagation) {
          event.stopPropagation();
        }
        onMarkAllAsRead();
      }}
    >
      <CheckCheck className="size-3.5" />
      Mark all as read
    </Button>
  );
}
