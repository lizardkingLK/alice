import { getLocalStorageJson, setLocalStorageJson } from '@/lib/local-storage';

export const WORK_ITEM_ACTIVITY_LAYOUT_IDS = [
  'cards',
  'timeline',
  'table',
] as const;

export type WorkItemActivityLayout =
  (typeof WORK_ITEM_ACTIVITY_LAYOUT_IDS)[number];

export type WorkItemActivityLayoutOption = {
  readonly id: WorkItemActivityLayout;
  readonly label: string;
  readonly description: string;
};

export const WORK_ITEM_ACTIVITY_LAYOUT_OPTIONS: readonly WorkItemActivityLayoutOption[] =
  [
    {
      id: 'cards',
      label: 'Cards',
      description: 'Bordered list rows',
    },
    {
      id: 'timeline',
      label: 'Timeline',
      description: 'Vertical rail with avatars',
    },
    {
      id: 'table',
      label: 'Table',
      description: 'When, actor, and details',
    },
  ];

const STORAGE_PREFIX = 'alice:work-item-activity-layout:v1:';
export const WORK_ITEM_ACTIVITY_LAYOUT_STORAGE_PREFIX = STORAGE_PREFIX;
export const DEFAULT_WORK_ITEM_ACTIVITY_LAYOUT: WorkItemActivityLayout =
  'cards';

export function workItemActivityLayoutStorageKey(workItemId: string): string {
  return `${STORAGE_PREFIX}${workItemId}`;
}

function isWorkItemActivityLayout(
  value: unknown
): value is WorkItemActivityLayout {
  return (
    typeof value === 'string' &&
    (WORK_ITEM_ACTIVITY_LAYOUT_IDS as readonly string[]).includes(value)
  );
}

/**
 * Per work-item Activity tab layout preference (browser localStorage).
 * Defaults to cards when missing, corrupt, or work item id is empty.
 */
export function readWorkItemActivityLayout(
  workItemId: string | null | undefined
): WorkItemActivityLayout {
  if (!workItemId) {
    return DEFAULT_WORK_ITEM_ACTIVITY_LAYOUT;
  }
  const parsed = getLocalStorageJson<unknown>(
    workItemActivityLayoutStorageKey(workItemId)
  );
  return isWorkItemActivityLayout(parsed)
    ? parsed
    : DEFAULT_WORK_ITEM_ACTIVITY_LAYOUT;
}

export function writeWorkItemActivityLayout(
  workItemId: string | null | undefined,
  layout: WorkItemActivityLayout
): void {
  if (!workItemId) {
    return;
  }
  setLocalStorageJson(workItemActivityLayoutStorageKey(workItemId), layout);
}
