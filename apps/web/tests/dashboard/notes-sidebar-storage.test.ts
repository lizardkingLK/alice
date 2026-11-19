import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();

vi.mock('@/lib/local-storage', () => ({
  getLocalStorageItem: (key: string) => store.get(key) ?? null,
  setLocalStorageItem: (key: string, value: string) => {
    store.set(key, value);
    return true;
  },
}));

import {
  parseNotesSidebarOpenCookie,
  resolveNotesSidebarOpen,
  writeNotesSidebarOpen,
} from '@/app/notes/_helpers/notes-sidebar-storage';

describe('notes sidebar storage', () => {
  beforeEach(() => {
    store.clear();
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: '',
    });
  });

  it('defaults cookie parse to open when missing', () => {
    expect(parseNotesSidebarOpenCookie(undefined)).toBe(true);
    expect(parseNotesSidebarOpenCookie('false')).toBe(false);
    expect(parseNotesSidebarOpenCookie('true')).toBe(true);
  });

  it('prefers cookie over localStorage when resolving', () => {
    store.set('alice:notes-drafts-sidebar-open:v1', 'false');
    expect(resolveNotesSidebarOpen('true')).toBe(true);
    expect(resolveNotesSidebarOpen(undefined)).toBe(false);
  });

  it('writes cookie and localStorage together', () => {
    writeNotesSidebarOpen(false);
    expect(store.get('alice:notes-drafts-sidebar-open:v1')).toBe('false');
    expect(document.cookie).toContain('notes_drafts_sidebar_state=false');
  });
});
