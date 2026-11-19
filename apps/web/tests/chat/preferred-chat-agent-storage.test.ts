import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PREFERRED_CHAT_AGENT_COOKIE_NAME,
  getPreferredChatAgentId,
  isPreferredChatAgentId,
  parsePreferredChatAgentCookie,
  setPreferredChatAgentId,
} from '@/app/chat/_helpers/preferred-chat-agent-storage';

const VALID_ID = '11111111-1111-4111-8111-111111111111';

describe('preferred-chat-agent-storage', () => {
  beforeEach(() => {
    vi.stubGlobal('document', { cookie: '' });
    vi.stubGlobal('window', {
      localStorage: {
        store: new Map<string, string>(),
        getItem(key: string) {
          return this.store.get(key) ?? null;
        },
        setItem(key: string, value: string) {
          this.store.set(key, value);
        },
        removeItem(key: string) {
          this.store.delete(key);
        },
      },
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('accepts uuid agent ids only', () => {
    expect(isPreferredChatAgentId(VALID_ID)).toBe(true);
    expect(isPreferredChatAgentId('system-project-manager')).toBe(false);
    expect(parsePreferredChatAgentCookie(undefined)).toBeNull();
    expect(parsePreferredChatAgentCookie(VALID_ID)).toBe(VALID_ID);
  });

  it('writes cookie and localStorage together', () => {
    setPreferredChatAgentId(VALID_ID);
    expect(document.cookie).toContain(
      `${PREFERRED_CHAT_AGENT_COOKIE_NAME}=${VALID_ID}`
    );
    expect(getPreferredChatAgentId()).toBe(VALID_ID);

    setPreferredChatAgentId(null);
    expect(document.cookie).toContain(
      `${PREFERRED_CHAT_AGENT_COOKIE_NAME}=; path=/; max-age=0`
    );
    expect(getPreferredChatAgentId()).toBeNull();
  });
});
