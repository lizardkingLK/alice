import { buildSavedViewHref } from '@repo/types';

export type NotificationNavInput = {
  readonly type: string;
  readonly related_item_id: string | null;
};

export type SavedViewNavSnapshot = {
  readonly pathname: string;
  readonly search: string;
  readonly status: string;
};

/** Fallback when a shared view is missing or archived. */
export const VIEW_SHARED_FALLBACK_HREF = '/views?tab=shared';

/** Fallback when a shared chart workspace is missing. */
export const CHART_SHARED_FALLBACK_HREF = '/charts';

/**
 * Resolve where a notification should navigate.
 * `view_shared` related_item_id is a saved view id — not a work item.
 * `chart_shared` related_item_id is a charts.id.
 */
export function resolveNotificationHref(
  notif: NotificationNavInput,
  sharedView: SavedViewNavSnapshot | null | undefined
): string | null {
  if (!notif.related_item_id) {
    return null;
  }

  if (notif.type === 'view_shared') {
    if (sharedView?.status === 'active') {
      return buildSavedViewHref(sharedView.pathname, sharedView.search);
    }
    return VIEW_SHARED_FALLBACK_HREF;
  }

  if (notif.type === 'chart_shared') {
    return `/charts/${notif.related_item_id}`;
  }

  if (notif.type === 'chat_processed') {
    return `/chat?conversationId=${notif.related_item_id}`;
  }

  return `/work-items/${notif.related_item_id}`;
}
