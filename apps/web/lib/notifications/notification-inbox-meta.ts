import type { ComponentType } from 'react';
import {
  Bell,
  AtSign,
  MessageSquare,
  RefreshCw,
  UserPlus,
  Calendar,
  AlertCircle,
  Layers,
  Inbox,
  FolderKanban,
  AlertTriangle,
  Timer,
  Archive,
  Trash2,
} from '@repo/ui/lib/icons';

export const NOTIFICATION_ICON_MAP: Record<
  string,
  ComponentType<{ className?: string }>
> = {
  mention: AtSign,
  comment: MessageSquare,
  status_change: RefreshCw,
  assign: UserPlus,
  sprint: Calendar,
  due_date: AlertCircle,
  view_shared: Layers,
  chat_processed: MessageSquare,
  access_request: Inbox,
  project_created: FolderKanban,
  project_create_failed: AlertTriangle,
  worklog_pending: Timer,
  entity_archived: Archive,
  entity_archive_failed: AlertTriangle,
  entity_purged: Trash2,
  entity_purge_failed: AlertTriangle,
  default: Bell,
};

export const NOTIFICATION_ICON_COLOR_MAP: Record<string, string> = {
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
  view_shared:
    'text-amber-500 bg-amber-500/10 border-amber-500/20 dark:bg-amber-500/20',
  chat_processed:
    'text-indigo-500 bg-indigo-500/10 border-indigo-500/20 dark:bg-indigo-500/20',
  access_request:
    'text-orange-500 bg-orange-500/10 border-orange-500/20 dark:bg-orange-500/20',
  project_created:
    'text-emerald-500 bg-emerald-500/10 border-emerald-500/20 dark:bg-emerald-500/20',
  project_create_failed:
    'text-rose-500 bg-rose-500/10 border-rose-500/20 dark:bg-rose-500/20',
  worklog_pending:
    'text-cyan-500 bg-cyan-500/10 border-cyan-500/20 dark:bg-cyan-500/20',
  entity_archived:
    'text-amber-500 bg-amber-500/10 border-amber-500/20 dark:bg-amber-500/20',
  entity_archive_failed:
    'text-rose-500 bg-rose-500/10 border-rose-500/20 dark:bg-rose-500/20',
  entity_purged:
    'text-slate-500 bg-slate-500/10 border-slate-500/20 dark:bg-slate-500/20',
  entity_purge_failed:
    'text-rose-500 bg-rose-500/10 border-rose-500/20 dark:bg-rose-500/20',
  default: 'text-muted-foreground bg-muted border-border',
};

export const UNREAD_BADGE_CAP = 9;

export function formatNotificationRelativeTime(dateString: string): string {
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

export function notificationsTriggerLabel(unreadCount: number): string {
  if (unreadCount <= 0) {
    return 'View notifications';
  }
  if (unreadCount > UNREAD_BADGE_CAP) {
    return 'View notifications, more than 9 unread';
  }
  return `View notifications, ${unreadCount} unread`;
}

export function inboxSubtitleText(params: {
  loading: boolean;
  loadFailed: boolean;
  unreadCount: number;
}): string {
  if (params.loading) {
    return 'Loading notifications';
  }
  if (params.loadFailed) {
    return 'Could not load notifications';
  }
  if (params.unreadCount === 0) {
    return 'You are all caught up';
  }
  const label = params.unreadCount === 1 ? 'notification' : 'notifications';
  return `${params.unreadCount} unread ${label}`;
}
