import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();

vi.mock('@/lib/local-storage', () => ({
  getLocalStorageJson: (key: string) => {
    const raw = store.get(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as unknown;
  },
  setLocalStorageJson: (key: string, value: unknown) => {
    store.set(key, JSON.stringify(value));
    return true;
  },
  removeLocalStorageItem: (key: string) => {
    store.delete(key);
    return true;
  },
}));

import {
  chatModelsFingerprint,
  clearCachedChatModels,
  readCachedChatModels,
  writeCachedChatModels,
} from '@/app/chat/_helpers/chat-models-storage';
import type { ChatModelOption } from '@repo/types';

const sampleModel: ChatModelOption = {
  id: '11111111-1111-4111-8111-111111111111',
  provider: 'openai',
  name: 'GPT',
  is_default: true,
  model: 'gpt-4o',
  display_label: 'GPT-4o',
};

describe('chat models storage', () => {
  beforeEach(() => {
    store.clear();
  });

  it('round-trips cached models for a user', () => {
    writeCachedChatModels('user-1', [sampleModel]);
    expect(readCachedChatModels('user-1')).toEqual([sampleModel]);
    expect(chatModelsFingerprint([sampleModel])).toBe(sampleModel.id);
  });

  it('ignores malformed cache rows', () => {
    store.set(
      'alice:chat-models-cache:v1:user-1',
      JSON.stringify({ models: [{ id: 'not-a-uuid' }] })
    );
    expect(readCachedChatModels('user-1')).toBeNull();
  });

  it('clears the cache', () => {
    writeCachedChatModels('user-1', [sampleModel]);
    clearCachedChatModels('user-1');
    expect(readCachedChatModels('user-1')).toBeNull();
  });
});
