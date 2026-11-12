/**
 * Which pane the Overview Focus widget shows (Focus timer/tasks vs Calendar).
 * Browser localStorage only.
 */

import { getLocalStorageJson, setLocalStorageJson } from '@/lib/local-storage';

const STORAGE_PREFIX = 'alice:overview-focus-pane:v1:';

export const FOCUS_WIDGET_PANES = ['focus', 'calendar'] as const;
export type FocusWidgetPane = (typeof FOCUS_WIDGET_PANES)[number];

export const DEFAULT_FOCUS_WIDGET_PANE: FocusWidgetPane = 'focus';

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

export function isFocusWidgetPane(value: unknown): value is FocusWidgetPane {
  return (
    typeof value === 'string' &&
    (FOCUS_WIDGET_PANES as readonly string[]).includes(value)
  );
}

export function readFocusWidgetPane(
  userId: string | null | undefined
): FocusWidgetPane {
  if (!userId) {
    return DEFAULT_FOCUS_WIDGET_PANE;
  }
  const raw = getLocalStorageJson(storageKey(userId));
  return isFocusWidgetPane(raw) ? raw : DEFAULT_FOCUS_WIDGET_PANE;
}

export function writeFocusWidgetPane(
  userId: string | null | undefined,
  pane: FocusWidgetPane
): void {
  if (!userId || !isFocusWidgetPane(pane)) {
    return;
  }
  setLocalStorageJson(storageKey(userId), pane);
}

export function shiftFocusWidgetPane(
  current: FocusWidgetPane,
  direction: -1 | 1
): FocusWidgetPane {
  const index = FOCUS_WIDGET_PANES.indexOf(current);
  const safeIndex = Math.max(index, 0);
  const next =
    (safeIndex + direction + FOCUS_WIDGET_PANES.length) %
    FOCUS_WIDGET_PANES.length;
  return FOCUS_WIDGET_PANES[next]!;
}
