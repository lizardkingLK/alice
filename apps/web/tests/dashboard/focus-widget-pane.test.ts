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
}));

import {
  DEFAULT_FOCUS_WIDGET_PANE,
  readFocusWidgetPane,
  shiftFocusWidgetPane,
  writeFocusWidgetPane,
} from '@/app/dashboard/_helpers/focus-widget-pane';

describe('focus widget pane', () => {
  beforeEach(() => {
    store.clear();
  });

  it('defaults to focus and round-trips', () => {
    expect(readFocusWidgetPane('user-1')).toBe(DEFAULT_FOCUS_WIDGET_PANE);
    writeFocusWidgetPane('user-1', 'calendar');
    expect(readFocusWidgetPane('user-1')).toBe('calendar');
  });

  it('cycles panes with chevron directions', () => {
    expect(shiftFocusWidgetPane('focus', 1)).toBe('calendar');
    expect(shiftFocusWidgetPane('calendar', 1)).toBe('focus');
    expect(shiftFocusWidgetPane('focus', -1)).toBe('calendar');
    expect(shiftFocusWidgetPane('calendar', -1)).toBe('focus');
  });
});
