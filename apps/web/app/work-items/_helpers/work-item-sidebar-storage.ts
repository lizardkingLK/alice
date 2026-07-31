import { getLocalStorageJson, setLocalStorageJson } from '@/lib/local-storage';

const MORE_FIELDS_STORAGE_PREFIX = 'alice:work-item-more-fields:';
const DEFAULT_MORE_FIELDS_OPEN = false;

function moreFieldsStorageKey(userId: string) {
  return `${MORE_FIELDS_STORAGE_PREFIX}${userId}`;
}

export function readMoreFieldsOpen(userId: string | null | undefined): boolean {
  if (!userId) {
    return DEFAULT_MORE_FIELDS_OPEN;
  }

  const parsed = getLocalStorageJson<unknown>(moreFieldsStorageKey(userId));
  return typeof parsed === 'boolean' ? parsed : DEFAULT_MORE_FIELDS_OPEN;
}

export function writeMoreFieldsOpen(
  userId: string | null | undefined,
  open: boolean
): void {
  if (!userId) {
    return;
  }
  setLocalStorageJson(moreFieldsStorageKey(userId), open);
}
