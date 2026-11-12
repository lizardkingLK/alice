/**
 * Warm client cache for workspace chat models.
 * Live fetches remain authoritative. Used so the header dock can skip the
 * loading spinner on remount after the first successful client fetch.
 */

import { chatModelOptionSchema, type ChatModelOption } from '@repo/types';
import {
  getLocalStorageJson,
  removeLocalStorageItem,
  setLocalStorageJson,
} from '@/lib/local-storage';

const STORAGE_PREFIX = 'alice:chat-models-cache:v1:';

type CachedChatModels = {
  readonly fingerprint: string;
  readonly savedAtMs: number;
  readonly models: readonly ChatModelOption[];
};

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

export function chatModelsFingerprint(
  models: readonly ChatModelOption[]
): string {
  return models
    .map((model) => model.id)
    .slice()
    .sort()
    .join(',');
}

function normalizeCachedModels(value: unknown): ChatModelOption[] | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (!Array.isArray(row.models)) {
    return null;
  }
  const models: ChatModelOption[] = [];
  for (const entry of row.models) {
    const parsed = chatModelOptionSchema.safeParse(entry);
    if (parsed.success) {
      models.push(parsed.data);
    }
  }
  if (models.length !== row.models.length) {
    return null;
  }
  return models;
}

export function readCachedChatModels(
  userId: string | null | undefined
): ChatModelOption[] | null {
  if (!userId) {
    return null;
  }
  const raw = getLocalStorageJson(storageKey(userId));
  return normalizeCachedModels(raw);
}

export function writeCachedChatModels(
  userId: string | null | undefined,
  models: readonly ChatModelOption[]
): void {
  if (!userId) {
    return;
  }
  const payload: CachedChatModels = {
    fingerprint: chatModelsFingerprint(models),
    savedAtMs: Date.now(),
    models,
  };
  setLocalStorageJson(storageKey(userId), payload);
}

export function clearCachedChatModels(userId: string | null | undefined): void {
  if (!userId) {
    return;
  }
  removeLocalStorageItem(storageKey(userId));
}
