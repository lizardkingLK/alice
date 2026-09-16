import { getLocalStorageJson, setLocalStorageJson } from '@/lib/local-storage';

export const BOARD_LAYOUT_IDS = ['board', 'grouped'] as const;

export type BoardLayoutId = (typeof BOARD_LAYOUT_IDS)[number];

export type BoardLayoutOption = {
  readonly id: BoardLayoutId;
  readonly label: string;
  readonly description: string;
};

export const BOARD_LAYOUT_OPTIONS: readonly BoardLayoutOption[] = [
  {
    id: 'board',
    label: 'Board',
    description: 'Classic Kanban columns',
  },
  {
    id: 'grouped',
    label: 'Grouped',
    description: 'Column groups as tables',
  },
];

const STORAGE_PREFIX = 'alice:board-layout:v1:';
const DEFAULT_LAYOUT: BoardLayoutId = 'board';

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

function isLayoutId(value: unknown): value is BoardLayoutId {
  return (
    typeof value === 'string' &&
    (BOARD_LAYOUT_IDS as readonly string[]).includes(value)
  );
}

export function readBoardLayout(
  userId: string | null | undefined
): BoardLayoutId {
  if (!userId) {
    return DEFAULT_LAYOUT;
  }
  const parsed = getLocalStorageJson<unknown>(storageKey(userId));
  return isLayoutId(parsed) ? parsed : DEFAULT_LAYOUT;
}

export function writeBoardLayout(
  userId: string | null | undefined,
  layout: BoardLayoutId
): void {
  if (!userId) {
    return;
  }
  setLocalStorageJson(storageKey(userId), layout);
}
