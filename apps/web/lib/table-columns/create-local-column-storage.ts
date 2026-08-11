/* eslint-disable no-unused-vars */
import type { VisibilityState } from '@tanstack/react-table';
import { getLocalStorageJson, setLocalStorageJson } from '@/lib/local-storage';

export type LocalColumnStorage<TId extends string> = {
  readonly storageKey: (userId: string) => string;
  readonly normalize: (value: unknown) => VisibilityState;
  readonly hasCustom: (visibility: VisibilityState) => boolean;
  readonly read: (userId: string | null | undefined) => VisibilityState;
  readonly write: (
    userId: string | null | undefined,
    visibility: VisibilityState
  ) => void;
  readonly isRequired: (id: TId) => boolean;
  readonly listOptions: () => readonly TId[];
};

type CreateLocalColumnStorageConfig<TId extends string> = {
  readonly columnIds: readonly TId[];
  readonly defaultVisibility: VisibilityState;
  readonly requiredIds: readonly TId[];
  readonly storagePrefix: string;
  readonly isColumnId?: (value: string) => value is TId;
};

export function createLocalColumnStorage<TId extends string>({
  columnIds,
  defaultVisibility,
  requiredIds,
  storagePrefix,
  isColumnId,
}: CreateLocalColumnStorageConfig<TId>): LocalColumnStorage<TId> {
  const requiredSet = new Set<string>(requiredIds);
  const columnIdSet = isColumnId
    ? null
    : new Set<string>(columnIds as readonly string[]);

  function storageKey(userId: string): string {
    return `${storagePrefix}${userId}`;
  }

  function isRequired(id: TId): boolean {
    return requiredSet.has(id);
  }

  function normalize(value: unknown): VisibilityState {
    const next: VisibilityState = { ...defaultVisibility };

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      for (const requiredId of requiredIds) {
        next[requiredId] = true;
      }
      return next;
    }

    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      const known =
        isColumnId !== undefined
          ? isColumnId(key)
          : columnIdSet?.has(key) === true;
      if (!known || typeof raw !== 'boolean') {
        continue;
      }
      next[key] = requiredSet.has(key) ? true : raw;
    }

    for (const requiredId of requiredIds) {
      next[requiredId] = true;
    }

    return next;
  }

  function hasCustom(visibility: VisibilityState): boolean {
    const normalized = normalize(visibility);
    return columnIds.some(
      (id) => !requiredSet.has(id) && normalized[id] !== defaultVisibility[id]
    );
  }

  function read(userId: string | null | undefined): VisibilityState {
    if (!userId) {
      return { ...defaultVisibility };
    }
    return normalize(getLocalStorageJson<unknown>(storageKey(userId)));
  }

  function write(
    userId: string | null | undefined,
    visibility: VisibilityState
  ): void {
    if (!userId) {
      return;
    }
    setLocalStorageJson(storageKey(userId), normalize(visibility));
  }

  function listOptions(): readonly TId[] {
    return columnIds;
  }

  return {
    storageKey,
    normalize,
    hasCustom,
    read,
    write,
    isRequired,
    listOptions,
  };
}
