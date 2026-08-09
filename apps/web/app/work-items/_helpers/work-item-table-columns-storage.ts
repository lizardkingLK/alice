import type { VisibilityState } from '@tanstack/react-table';
import { getLocalStorageJson, setLocalStorageJson } from '@/lib/local-storage';

export const WORK_ITEM_TABLE_COLUMN_IDS = [
  'title',
  'type',
  'status',
  'priority',
  'assignee',
  'due_date',
  'actions',
  'project',
  'sprint',
  'reporter',
  'story_points',
  'labels',
] as const;

export type WorkItemTableColumnId = (typeof WORK_ITEM_TABLE_COLUMN_IDS)[number];

export const REQUIRED_WORK_ITEM_TABLE_COLUMN_IDS = [
  'title',
] as const satisfies readonly WorkItemTableColumnId[];

/** O(1) membership for known column ids (arrays keep stable iteration order). */
const WORK_ITEM_TABLE_COLUMN_ID_SET: ReadonlySet<string> = new Set(
  WORK_ITEM_TABLE_COLUMN_IDS
);

const REQUIRED_WORK_ITEM_TABLE_COLUMN_ID_SET: ReadonlySet<WorkItemTableColumnId> =
  new Set(REQUIRED_WORK_ITEM_TABLE_COLUMN_IDS);

export function isWorkItemTableColumnId(
  value: string
): value is WorkItemTableColumnId {
  return WORK_ITEM_TABLE_COLUMN_ID_SET.has(value);
}

export function isRequiredWorkItemTableColumnId(
  id: WorkItemTableColumnId
): boolean {
  return REQUIRED_WORK_ITEM_TABLE_COLUMN_ID_SET.has(id);
}

export const WORK_ITEM_TABLE_COLUMN_LABELS: Record<
  WorkItemTableColumnId,
  string
> = {
  title: 'Title',
  type: 'Type',
  status: 'Status',
  priority: 'Priority',
  assignee: 'Assignee',
  due_date: 'Due Date',
  actions: 'Actions',
  project: 'Project',
  sprint: 'Sprint',
  reporter: 'Reporter',
  story_points: 'Story points',
  labels: 'Labels',
};

/** Today’s table columns on; optional fields off. */
export const DEFAULT_WORK_ITEM_TABLE_COLUMN_VISIBILITY: VisibilityState = {
  title: true,
  type: true,
  status: true,
  priority: true,
  assignee: true,
  due_date: true,
  actions: true,
  project: false,
  sprint: false,
  reporter: false,
  story_points: false,
  labels: false,
};

/** Readable by the server so SSR can paint preferred columns in one shot. */
export const WORK_ITEM_TABLE_COLUMNS_COOKIE = 'alice_wi_cols_v1';

const STORAGE_KEY_PREFIX = 'alice:work-item-table-columns:v1:';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function storageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}${userId}`;
}

/**
 * Merge stored (or partial) visibility with defaults and force required columns
 * on. Unknown keys are dropped.
 */
export function normalizeWorkItemTableColumnVisibility(
  raw: unknown
): VisibilityState {
  const next: VisibilityState = {
    ...DEFAULT_WORK_ITEM_TABLE_COLUMN_VISIBILITY,
  };

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return next;
  }

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isWorkItemTableColumnId(key) || typeof value !== 'boolean') {
      continue;
    }
    next[key] = isRequiredWorkItemTableColumnId(key) ? true : value;
  }

  for (const requiredId of REQUIRED_WORK_ITEM_TABLE_COLUMN_IDS) {
    next[requiredId] = true;
  }

  return next;
}

export function encodeWorkItemTableColumnVisibilityCookie(
  visibility: VisibilityState
): string {
  return encodeURIComponent(
    JSON.stringify(normalizeWorkItemTableColumnVisibility(visibility))
  );
}

export function parseWorkItemTableColumnVisibilityCookie(
  raw: string | undefined | null
): VisibilityState {
  if (!raw) {
    return { ...DEFAULT_WORK_ITEM_TABLE_COLUMN_VISIBILITY };
  }

  try {
    return normalizeWorkItemTableColumnVisibility(
      JSON.parse(decodeURIComponent(raw)) as unknown
    );
  } catch {
    return { ...DEFAULT_WORK_ITEM_TABLE_COLUMN_VISIBILITY };
  }
}

function writeWorkItemTableColumnVisibilityCookie(
  visibility: VisibilityState
): void {
  if (typeof document === 'undefined') {
    return;
  }

  const value = encodeWorkItemTableColumnVisibilityCookie(visibility);
  document.cookie = [
    `${WORK_ITEM_TABLE_COLUMNS_COOKIE}=${value}`,
    'path=/',
    `max-age=${COOKIE_MAX_AGE_SECONDS}`,
    'SameSite=Lax',
  ].join('; ');
}

export function readWorkItemTableColumnVisibility(
  userId: string | null | undefined
): VisibilityState {
  if (!userId) {
    return { ...DEFAULT_WORK_ITEM_TABLE_COLUMN_VISIBILITY };
  }

  const parsed = getLocalStorageJson<unknown>(storageKey(userId));
  return normalizeWorkItemTableColumnVisibility(parsed);
}

export function writeWorkItemTableColumnVisibility(
  userId: string | null | undefined,
  visibility: VisibilityState
): void {
  const normalized = normalizeWorkItemTableColumnVisibility(visibility);
  if (userId) {
    setLocalStorageJson(storageKey(userId), normalized);
  }
  writeWorkItemTableColumnVisibilityCookie(normalized);
}

/** Visible column count for skeleton placeholders (defaults when not hydrated). */
export function countVisibleWorkItemTableColumns(
  visibility: VisibilityState
): number {
  return WORK_ITEM_TABLE_COLUMN_IDS.reduce((count, id) => {
    return visibility[id] !== false ? count + 1 : count;
  }, 0);
}

export function workItemTableColumnVisibilityEquals(
  left: VisibilityState,
  right: VisibilityState
): boolean {
  return WORK_ITEM_TABLE_COLUMN_IDS.every(
    (id) => (left[id] !== false) === (right[id] !== false)
  );
}

/** True when visibility differs from the stock default set. */
export function hasCustomWorkItemTableColumnVisibility(
  visibility: VisibilityState,
  options: { readonly isProjectLocked?: boolean } = {}
): boolean {
  const baseline = normalizeWorkItemTableColumnVisibility({
    ...DEFAULT_WORK_ITEM_TABLE_COLUMN_VISIBILITY,
    ...(options.isProjectLocked ? { project: false } : {}),
  });
  const current = normalizeWorkItemTableColumnVisibility({
    ...visibility,
    ...(options.isProjectLocked ? { project: false } : {}),
  });
  return !workItemTableColumnVisibilityEquals(current, baseline);
}

/** Columns shown in the customization dialog (excludes locked project). */
export function listWorkItemTableColumnOptions(options: {
  readonly isProjectLocked: boolean;
}): readonly WorkItemTableColumnId[] {
  return WORK_ITEM_TABLE_COLUMN_IDS.filter(
    (id) => !(options.isProjectLocked && id === 'project')
  );
}
