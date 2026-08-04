import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  readWorkItemCreateFormMode,
  writeWorkItemCreateFormMode,
  WORK_ITEM_CREATE_FORM_MODE_CHANGED_EVENT,
} from '@/app/work-items/_helpers/work-item-create-form-preference';

const STORAGE_KEY = 'alice:work-item-create-form-mode';

describe('work-item-create-form-preference', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('defaults to classic when nothing is stored', () => {
    expect(readWorkItemCreateFormMode()).toBe('classic');
  });

  it('persists modern and classic modes', () => {
    writeWorkItemCreateFormMode('modern');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')).toBe(
      'modern'
    );
    expect(readWorkItemCreateFormMode()).toBe('modern');

    writeWorkItemCreateFormMode('classic');
    expect(readWorkItemCreateFormMode()).toBe('classic');
  });

  it('ignores corrupt stored values', () => {
    localStorage.setItem(STORAGE_KEY, '"fullscreen"');
    expect(readWorkItemCreateFormMode()).toBe('classic');
  });

  it('emits a same-tab change event on write', () => {
    const listener = vi.fn();
    window.addEventListener(WORK_ITEM_CREATE_FORM_MODE_CHANGED_EVENT, listener);

    writeWorkItemCreateFormMode('modern');

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(
      WORK_ITEM_CREATE_FORM_MODE_CHANGED_EVENT,
      listener
    );
  });
});
