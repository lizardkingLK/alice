'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Database } from '@repo/types';
import { createClient } from '@/lib/supabase/client';
import { extractEmailFromAccessRequestMessage } from '@/lib/notifications/access-request-message';
import {
  DASHBOARD_INBOX_LIMIT,
  fetchDashboardInboxNotifications,
} from '@/lib/notifications/fetch-dashboard-inbox';
import { resolveNotificationHref } from '@/lib/notifications/resolve-notification-href';

export type Notification = Database['public']['Tables']['notifications']['Row'];

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

function inboxLoadErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }
  return 'unknown error';
}

function warnInboxLoadFailed(error: unknown): void {
  console.warn(
    'warn. failed to load dashboard notifications:',
    inboxLoadErrorMessage(error)
  );
}

export function useNotificationsInbox(params: {
  userId: string;
  limit?: number;
  initialNotifications?: Notification[];
  initialLoadFailed?: boolean;
  /**
   * Disambiguates Supabase Realtime channel names when multiple inboxes
   * mount at once (header bell + `/notifications` page).
   */
  realtimeChannelScope?: string;
}) {
  const {
    userId,
    limit = DASHBOARD_INBOX_LIMIT,
    initialNotifications,
    initialLoadFailed = false,
    realtimeChannelScope = 'inbox',
  } = params;
  const skipClientFetch = initialNotifications !== undefined;
  const [notifications, setNotifications] = useState<Notification[]>(
    initialNotifications ?? []
  );
  const [loadFailed, setLoadFailed] = useState(initialLoadFailed);
  const [loading, setLoading] = useState(!skipClientFetch);
  const [selectedAccessRequest, setSelectedAccessRequest] =
    useState<Notification | null>(null);
  const router = useRouter();

  const loadInbox = useCallback(async () => {
    if (!userId) {
      return;
    }

    setLoading(true);
    setLoadFailed(false);
    const supabase = createClient();
    const { data, error } = await fetchDashboardInboxNotifications(
      supabase,
      userId,
      limit
    );

    if (error) {
      warnInboxLoadFailed(error);
      setLoadFailed(true);
      setNotifications([]);
      setLoading(false);
      return;
    }

    setNotifications(data ?? []);
    setLoading(false);
  }, [limit, userId]);

  const onInboxLoadRejected = useCallback((error: unknown) => {
    warnInboxLoadFailed(error);
    setLoadFailed(true);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (skipClientFetch) {
      setNotifications(initialNotifications ?? []);
      setLoadFailed(initialLoadFailed);
      setLoading(false);
      return;
    }

    loadInbox().catch(onInboxLoadRejected);
  }, [
    initialLoadFailed,
    initialNotifications,
    loadInbox,
    onInboxLoadRejected,
    skipClientFetch,
  ]);

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
        setNotifications((prev) => [newNotif, ...prev].slice(0, limit));
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
      .channel(`notifications:${realtimeChannelScope}:${userId}`)
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
      // removeChannel may return void (mocks) or a Promise (supabase-js).
      const teardown = Promise.resolve(supabase.removeChannel(channel));
      teardown.catch(() => {});
    };
  }, [limit, realtimeChannelScope, userId]);

  const handleRetry = () => {
    loadInbox().catch(onInboxLoadRejected);
  };

  const unreadCount = notifications.filter((n) => !n.read_status).length;

  const handleMarkAsRead = async (id: string) => {
    const supabase = createClient();
    const current = notifications.find((n) => n.id === id);
    setNotifications((prev) => {
      const target = prev.find((n) => n.id === id);
      if (!target) {
        return prev;
      }
      return updateNotificationsList(prev, { ...target, read_status: true });
    });

    const { error } = await supabase
      .from('notifications')
      .update({ read_status: true, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Failed to mark notification as read:', error);
      if (!current) {
        return;
      }
      setNotifications((prev) =>
        updateNotificationsList(prev, { ...current, read_status: false })
      );
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!userId) return;
    const supabase = createClient();

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
      const { data } = await fetchDashboardInboxNotifications(
        supabase,
        userId,
        limit
      );
      if (data) setNotifications(data);
    }
  };

  const handleArchive = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

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
      if (userId) {
        const { data } = await fetchDashboardInboxNotifications(
          supabase,
          userId,
          limit
        );
        if (data) setNotifications(data);
      }
    }
  };

  const handleNotificationClick = async (
    notif: Notification,
    options?: { onBeforeNavigate?: () => void }
  ) => {
    options?.onBeforeNavigate?.();
    if (!notif.read_status) {
      await handleMarkAsRead(notif.id);
    }
    const isAccessRequest =
      notif.type === 'access_request' ||
      (notif.related_item_id === null &&
        (notif.message.includes('Access request') ||
          notif.message.includes('Access Request')));
    if (isAccessRequest) {
      if (notif.type === 'access_request' && notif.related_item_id) {
        const email = extractEmailFromAccessRequestMessage(notif.message);
        const params = new URLSearchParams({
          tab: 'requests',
          requestId: notif.related_item_id,
        });
        if (email) {
          params.set('addEmail', email);
        }
        router.push(`/users?${params.toString()}`);
        return;
      }
      setSelectedAccessRequest(notif);
      return;
    }
    if (notif.type === 'worklog_pending') {
      router.push('/member');
      return;
    }
    if (!notif.related_item_id) {
      return;
    }

    let sharedView: {
      pathname: string;
      search: string;
      status: string;
    } | null = null;

    if (notif.type === 'view_shared') {
      const supabase = createClient();
      const { data } = await supabase
        .from('saved_views')
        .select('pathname, search, status')
        .eq('id', notif.related_item_id)
        .maybeSingle();
      sharedView = data;
    }

    const href = resolveNotificationHref(notif, sharedView);
    if (href) {
      router.push(href);
    }
  };

  const closeAccessRequestDialog = () => setSelectedAccessRequest(null);

  const allowAccessRequest = () => {
    if (!selectedAccessRequest) {
      return;
    }
    const email = extractEmailFromAccessRequestMessage(
      selectedAccessRequest.message
    );
    const requestId = selectedAccessRequest.related_item_id;
    setSelectedAccessRequest(null);
    if (requestId) {
      const params = new URLSearchParams({
        tab: 'requests',
        requestId,
      });
      if (email) {
        params.set('addEmail', email);
      }
      router.push(`/users?${params.toString()}`);
    } else if (email) {
      router.push(`/users?tab=requests&addEmail=${encodeURIComponent(email)}`);
    } else {
      router.push('/users?tab=requests');
    }
  };

  return {
    notifications,
    loading,
    loadFailed,
    unreadCount,
    selectedAccessRequest,
    handleRetry,
    handleMarkAsRead,
    handleMarkAllAsRead,
    handleArchive,
    handleNotificationClick,
    closeAccessRequestDialog,
    allowAccessRequest,
  };
}
