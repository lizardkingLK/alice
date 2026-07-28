'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@repo/types';
import {
  Bell,
  AtSign,
  MessageSquare,
  RefreshCw,
  UserPlus,
  Calendar,
  AlertCircle,
  CheckCheck,
  InboxIcon,
  X,
} from '@repo/ui/lib/icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import { cn } from '@repo/ui/lib/utils';

type Notification = Database['public']['Tables']['notifications']['Row'];

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  mention: AtSign,
  comment: MessageSquare,
  status_change: RefreshCw,
  assign: UserPlus,
  sprint: Calendar,
  due_date: AlertCircle,
  default: Bell,
};

const iconColorMap: Record<string, string> = {
  mention:
    'text-violet-500 bg-violet-500/10 border-violet-500/20 dark:bg-violet-500/20',
  comment: 'text-sky-500 bg-sky-500/10 border-sky-500/20 dark:bg-sky-500/20',
  status_change:
    'text-amber-500 bg-amber-500/10 border-amber-500/20 dark:bg-amber-500/20',
  assign:
    'text-emerald-500 bg-emerald-500/10 border-emerald-500/20 dark:bg-emerald-500/20',
  sprint: 'text-pink-500 bg-pink-500/10 border-pink-500/20 dark:bg-pink-500/20',
  due_date:
    'text-rose-500 bg-rose-500/10 border-rose-500/20 dark:bg-rose-500/20',
  default: 'text-muted-foreground bg-muted border-border',
};

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${diffDays}d ago`;
}

function updateNotificationsList(
  prev: Notification[],
  updated: Notification
): Notification[] {
  const result: Notification[] = [];
  for (const n of prev) {
    if (n.id === updated.id) {
      result.push(updated);
    } else {
      result.push(n);
    }
  }
  return result;
}

function removeNotificationFromList(
  prev: Notification[],
  id: string
): Notification[] {
  const result: Notification[] = [];
  for (const n of prev) {
    if (n.id !== id) {
      result.push(n);
    }
  }
  return result;
}

export function NotificationInbox() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    const initUserAndData = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setLoading(false);
          return;
        }

        setUserId(user.id);

        // Fetch notifications
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) {
          console.error('Failed to fetch notifications:', error);
        } else if (data) {
          setNotifications(data);
        }
      } catch (err) {
        console.error('Error during notification initialization:', err);
      } finally {
        setLoading(false);
      }
    };

    initUserAndData();
  }, []);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();

    const handleRealtimePayload = (payload: {
      eventType: string;
      new: Record<string, unknown>;
      old: Record<string, unknown>;
    }) => {
      const { eventType, new: newRec, old: oldRec } = payload;
      if (eventType === 'INSERT') {
        const newNotif = newRec as Notification;
        setNotifications((prev) => [newNotif, ...prev]);
      } else if (eventType === 'UPDATE') {
        const updatedNotif = newRec as Notification;
        setNotifications((prev) => updateNotificationsList(prev, updatedNotif));
      } else if (eventType === 'DELETE') {
        const deletedNotif = oldRec as { id: string };
        setNotifications((prev) =>
          removeNotificationFromList(prev, deletedNotif.id)
        );
      }
    };

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        handleRealtimePayload
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const unreadCount = notifications.filter((n) => !n.read_status).length;

  const handleMarkAsRead = async (id: string) => {
    const supabase = createClient();
    // Optimistic update
    setNotifications((prev) => {
      const result: Notification[] = [];
      for (const n of prev) {
        if (n.id === id) {
          result.push({ ...n, read_status: true });
        } else {
          result.push(n);
        }
      }
      return result;
    });

    const { error } = await supabase
      .from('notifications')
      .update({ read_status: true, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Failed to mark notification as read:', error);
      // Rollback on error
      setNotifications((prev) => {
        const result: Notification[] = [];
        for (const n of prev) {
          if (n.id === id) {
            result.push({ ...n, read_status: false });
          } else {
            result.push(n);
          }
        }
        return result;
      });
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!userId) return;
    const supabase = createClient();

    // Optimistic update
    setNotifications((prev) => {
      const result: Notification[] = [];
      for (const n of prev) {
        result.push({ ...n, read_status: true });
      }
      return result;
    });

    const { error } = await supabase
      .from('notifications')
      .update({ read_status: true, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('read_status', false);

    if (error) {
      console.error('Failed to mark all notifications as read:', error);
      // Re-fetch notifications to restore correct state
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) setNotifications(data);
    }
  };

  const handleArchive = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    // Optimistic update: filter out from UI
    setNotifications((prev) => {
      const result: Notification[] = [];
      for (const n of prev) {
        if (n.id !== id) {
          result.push(n);
        }
      }
      return result;
    });

    const supabase = createClient();
    const { error } = await supabase
      .from('notifications')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Failed to archive notification:', error);
      // Re-fetch to restore state on error
      if (userId) {
        const { data } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(50);
        if (data) setNotifications(data);
      }
    }
  };

  const handleNotificationClick = async (notif: Notification) => {
    setIsOpen(false);
    if (!notif.read_status) {
      await handleMarkAsRead(notif.id);
    }
    if (notif.related_item_id) {
      router.push(`/work-items/${notif.related_item_id}`);
    }
  };

  const getSubTitleText = () => {
    if (unreadCount === 0) return 'You are all caught up';
    const label = unreadCount === 1 ? 'notification' : 'notifications';
    return `${unreadCount} unread ${label}`;
  };

  const renderNotificationsList = () => {
    if (loading) {
      return (
        <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 py-8 text-sm">
          <div className="border-primary size-4 animate-spin rounded-full border-2 border-t-transparent" />
          <span>Loading notifications...</span>
        </div>
      );
    }

    if (notifications.length === 0) {
      return (
        <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
          <div className="bg-muted/40 border-border/50 rounded-full border p-3">
            <InboxIcon className="text-muted-foreground/60 size-6" />
          </div>
          <div className="space-y-1">
            <p className="text-foreground text-sm font-medium">
              No notifications yet
            </p>
            <p className="max-w-xs text-xs">
              We&apos;ll let you know when you get mentioned or updates occur.
            </p>
          </div>
        </div>
      );
    }

    return notifications.map((notif) => {
      const Icon = (iconMap[notif.type] ||
        iconMap.default ||
        Bell) as React.ComponentType<{ className?: string }>;
      const iconStyles = notif.read_status
        ? 'text-muted-foreground bg-muted border-border'
        : iconColorMap[notif.type] || iconColorMap.default || '';

      return (
        <div
          key={notif.id}
          className={cn(
            'group hover:bg-accent/40 focus-within:bg-accent/40 relative flex items-start gap-3 p-3.5 transition-colors',
            !notif.read_status && 'bg-primary/2 dark:bg-primary/1'
          )}
        >
          <button
            type="button"
            onClick={() => handleNotificationClick(notif)}
            className="flex flex-1 cursor-pointer items-start gap-3 text-left focus-visible:outline-hidden"
          >
            <div
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-lg border text-sm font-semibold',
                iconStyles
              )}
            >
              <Icon className="size-4" />
            </div>
            <div className="min-w-0 flex-1 space-y-1 pr-2">
              <p
                className={cn(
                  'text-xs leading-relaxed wrap-break-word',
                  notif.read_status
                    ? 'text-muted-foreground'
                    : 'text-foreground font-medium'
                )}
              >
                {notif.message}
              </p>
              <span className="text-muted-foreground block text-[10px]">
                {formatRelativeTime(notif.created_at)}
              </span>
            </div>
          </button>
          <div className="flex shrink-0 items-center gap-1.5 self-center">
            {!notif.read_status && (
              <span className="bg-primary size-2 animate-pulse rounded-full" />
            )}
            <button
              type="button"
              onClick={(e) => handleArchive(notif.id, e)}
              aria-label="Archive notification"
              className="hover:bg-accent text-muted-foreground/60 hover:text-foreground flex size-6 cursor-pointer items-center justify-center rounded-md opacity-0 transition-all group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-hidden"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      );
    });
  };

  if (!userId) return null;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="View notifications"
          className="border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border transition-all focus-visible:outline-hidden active:scale-95"
        >
          <Bell
            className={cn(
              'size-4 transition-transform duration-300',
              unreadCount > 0 && 'animate-wiggle'
            )}
          />
          {unreadCount > 0 && (
            <span className="ring-background animate-fade-in absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="bg-background/95 border-border w-95 overflow-hidden rounded-xl border p-0 shadow-2xl backdrop-blur-md"
      >
        <div className="border-border bg-muted/20 flex items-center justify-between border-b px-4 py-3">
          <div>
            <h3 className="text-foreground text-sm font-semibold">
              Notifications
            </h3>
            <p className="text-muted-foreground text-xs">{getSubTitleText()}</p>
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleMarkAllAsRead();
              }}
              className="text-primary hover:text-primary/80 flex cursor-pointer items-center gap-1 text-xs font-medium transition-colors"
            >
              <CheckCheck className="size-3.5" />
              Mark all as read
            </button>
          )}
        </div>

        <div className="divide-border/60 max-h-90 divide-y overflow-y-auto">
          {renderNotificationsList()}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
