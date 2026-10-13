import { getLocalStorageJson, setLocalStorageJson } from '@/lib/local-storage';

export const BACKLOG_CAPACITY_DISPLAY_IDS = [
  'bar',
  'numbers',
  'percentage',
] as const;

export type BacklogCapacityDisplayId =
  (typeof BACKLOG_CAPACITY_DISPLAY_IDS)[number];

export type BacklogCapacityDisplayOption = {
  readonly id: BacklogCapacityDisplayId;
  readonly label: string;
  readonly description: string;
};

export const BACKLOG_CAPACITY_DISPLAY_OPTIONS: readonly BacklogCapacityDisplayOption[] =
  [
    {
      id: 'bar',
      label: 'Progress bar',
      description: 'Show a bar and planned / capacity in the sprint header',
    },
    {
      id: 'numbers',
      label: 'Numbers',
      description: 'Show planned / capacity in the sprint header',
    },
    {
      id: 'percentage',
      label: 'Percentage',
      description: 'Show rounded percent of capacity used in the sprint header',
    },
  ];

const STORAGE_PREFIX = 'alice:backlog-capacity-display:';
const DEFAULT_DISPLAY: BacklogCapacityDisplayId = 'bar';

/** Legacy ids from the gauge-only era — map into the current set. */
const LEGACY_DISPLAY_MAP: Readonly<Record<string, BacklogCapacityDisplayId>> = {
  icon: 'bar',
};

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

function isCapacityDisplayId(
  value: unknown
): value is BacklogCapacityDisplayId {
  return (
    typeof value === 'string' &&
    (BACKLOG_CAPACITY_DISPLAY_IDS as readonly string[]).includes(value)
  );
}

function coerceCapacityDisplayId(
  value: unknown
): BacklogCapacityDisplayId | null {
  if (isCapacityDisplayId(value)) {
    return value;
  }
  if (typeof value === 'string' && value in LEGACY_DISPLAY_MAP) {
    return LEGACY_DISPLAY_MAP[value]!;
  }
  return null;
}

export function readBacklogCapacityDisplay(
  userId: string | null | undefined
): BacklogCapacityDisplayId {
  if (!userId) {
    return DEFAULT_DISPLAY;
  }

  const parsed = getLocalStorageJson<unknown>(storageKey(userId));
  return coerceCapacityDisplayId(parsed) ?? DEFAULT_DISPLAY;
}

export function writeBacklogCapacityDisplay(
  userId: string | null | undefined,
  display: BacklogCapacityDisplayId
): void {
  if (!userId) {
    return;
  }
  setLocalStorageJson(storageKey(userId), display);
}
