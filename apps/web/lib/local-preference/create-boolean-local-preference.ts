/* eslint-disable no-unused-vars */
import { getLocalStorageJson, setLocalStorageJson } from '@/lib/local-storage';

export type BooleanLocalPreference = {
  readonly storageKey: (userId: string) => string;
  readonly read: (userId: string | null | undefined) => boolean;
  readonly write: (userId: string | null | undefined, value: boolean) => void;
};

type CreateBooleanLocalPreferenceConfig = {
  readonly storagePrefix: string;
  readonly defaultValue: boolean;
};

/** Per-user boolean preference in localStorage (`prefix` + userId). */
export function createBooleanLocalPreference({
  storagePrefix,
  defaultValue,
}: CreateBooleanLocalPreferenceConfig): BooleanLocalPreference {
  function storageKey(userId: string): string {
    return `${storagePrefix}${userId}`;
  }

  function read(userId: string | null | undefined): boolean {
    if (!userId) {
      return defaultValue;
    }
    const parsed = getLocalStorageJson<unknown>(storageKey(userId));
    return typeof parsed === 'boolean' ? parsed : defaultValue;
  }

  function write(userId: string | null | undefined, value: boolean): void {
    if (!userId) {
      return;
    }
    setLocalStorageJson(storageKey(userId), value);
  }

  return { storageKey, read, write };
}
