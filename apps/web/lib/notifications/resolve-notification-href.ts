import { buildSavedViewHref } from '@repo/types';

export type NotificationNavInput = {
  readonly type: string;
  readonly related_item_id: string | null;
  /** Optional body — used for entity archive/purge markdown links. */
  readonly message?: string;
};

const DESTRUCTIVE_NOTIFICATION_TYPES = new Set([
  'entity_archived',
  'entity_archive_failed',
  'entity_purged',
  'entity_purge_failed',
]);

/** First in-app markdown link in notification copy, if any. */
export function extractFirstInternalMarkdownHref(
  message: string | undefined
): string | null {
  if (!message) {
    return null;
  }
  // Linear scan: find "](/...)" then walk back to the matching "[".
  const pathStart = message.indexOf('](/');
  if (pathStart === -1) {
    return null;
  }
  const openBracket = message.lastIndexOf('[', pathStart);
  if (openBracket === -1) {
    return null;
  }
  const pathEnd = message.indexOf(')', pathStart + 3);
  if (pathEnd === -1) {
    return null;
  }
  const href = message.slice(pathStart + 2, pathEnd);
  return href.startsWith('/') ? href : null;
}

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
  if (notif.type === 'worklog_pending') {
    return '/member';
  }

  if (DESTRUCTIVE_NOTIFICATION_TYPES.has(notif.type)) {
    return extractFirstInternalMarkdownHref(notif.message);
  }

  if (notif.type === 'project_create_failed') {
    return null;
  }

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

  if (notif.type === 'project_created') {
    return `/projects/${notif.related_item_id}`;
  }

  return `/work-items/${notif.related_item_id}`;
}
