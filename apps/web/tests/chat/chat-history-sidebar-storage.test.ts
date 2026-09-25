import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  CHAT_HISTORY_SIDEBAR_COOKIE_NAME,
  parseChatHistorySidebarOpenCookie,
  writeChatHistorySidebarOpenCookie,
} from '@/app/chat/_helpers/chat-history-sidebar-storage';

describe('chat-history-sidebar-storage', () => {
  beforeEach(() => {
    vi.stubGlobal('document', { cookie: '' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to expanded when cookie is missing', () => {
    expect(parseChatHistorySidebarOpenCookie(undefined)).toBe(true);
  });

  it('parses true and false cookie values', () => {
    expect(parseChatHistorySidebarOpenCookie('true')).toBe(true);
    expect(parseChatHistorySidebarOpenCookie('false')).toBe(false);
    expect(parseChatHistorySidebarOpenCookie('nope')).toBe(false);
  });

  it('writes the open preference as a path=/ cookie', () => {
    writeChatHistorySidebarOpenCookie(false);
    expect(document.cookie).toContain(
      `${CHAT_HISTORY_SIDEBAR_COOKIE_NAME}=false`
    );
    expect(document.cookie).toContain('path=/');

    writeChatHistorySidebarOpenCookie(true);
    expect(document.cookie).toContain(
      `${CHAT_HISTORY_SIDEBAR_COOKIE_NAME}=true`
    );
  });
});
