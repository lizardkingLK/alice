/**
 * Which KPI pane the Overview Categories (My Work) widget shows.
 * Browser localStorage only.
 */

import { getLocalStorageJson, setLocalStorageJson } from '@/lib/local-storage';

const STORAGE_PREFIX = 'alice:overview-my-work-categories-pane:v1:';

/** Assigned (new) → In progress → Pending stories. */
export const MY_WORK_CATEGORIES_PANES = [
  'assigned',
  'in-progress',
  'pending-stories',
] as const;
export type MyWorkCategoriesPane = (typeof MY_WORK_CATEGORIES_PANES)[number];

export const DEFAULT_MY_WORK_CATEGORIES_PANE: MyWorkCategoriesPane = 'assigned';

export const MY_WORK_CATEGORIES_PANE_META: Readonly<
  Record<
    MyWorkCategoriesPane,
    { readonly title: string; readonly description: string }
  >
> = {
  assigned: {
    title: 'Assigned to you',
    description: 'Open work items',
  },
  'in-progress': {
    title: 'In progress',
    description: 'Actively moving',
  },
  'pending-stories': {
    title: 'Pending stories',
    description: 'Stories still open',
  },
};

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

export function isMyWorkCategoriesPane(
  value: unknown
): value is MyWorkCategoriesPane {
  return (
    typeof value === 'string' &&
    (MY_WORK_CATEGORIES_PANES as readonly string[]).includes(value)
  );
}

export function readMyWorkCategoriesPane(
  userId: string | null | undefined
): MyWorkCategoriesPane {
  if (!userId) {
    return DEFAULT_MY_WORK_CATEGORIES_PANE;
  }
  const raw = getLocalStorageJson(storageKey(userId));
  return isMyWorkCategoriesPane(raw) ? raw : DEFAULT_MY_WORK_CATEGORIES_PANE;
}

export function writeMyWorkCategoriesPane(
  userId: string | null | undefined,
  pane: MyWorkCategoriesPane
): void {
  if (!userId || !isMyWorkCategoriesPane(pane)) {
    return;
  }
  setLocalStorageJson(storageKey(userId), pane);
}

export function shiftMyWorkCategoriesPane(
  current: MyWorkCategoriesPane,
  direction: -1 | 1
): MyWorkCategoriesPane {
  const index = MY_WORK_CATEGORIES_PANES.indexOf(current);
  const safeIndex = Math.max(index, 0);
  const next =
    (safeIndex + direction + MY_WORK_CATEGORIES_PANES.length) %
    MY_WORK_CATEGORIES_PANES.length;
  return MY_WORK_CATEGORIES_PANES[next]!;
}
