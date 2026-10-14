import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PRODUCTIVITY_DASHBOARD_PREFERENCES,
  encodeProductivityDashboardPreferencesCookie,
  normalizeProductivityDashboardPreferences,
  parseProductivityDashboardPreferencesCookie,
  productivityDashboardPreferencesEquals,
} from '@/app/dashboard/_helpers/productivity-dashboard-preferences';

describe('productivity-dashboard-preferences', () => {
  it('normalizes unknown blobs to defaults', () => {
    expect(normalizeProductivityDashboardPreferences(null)).toEqual(
      DEFAULT_PRODUCTIVITY_DASHBOARD_PREFERENCES
    );
  });

  it('keeps known mode and widget flags', () => {
    const next = normalizeProductivityDashboardPreferences({
      mode: 'charts',
      widgets: {
        ...DEFAULT_PRODUCTIVITY_DASHBOARD_PREFERENCES.widgets,
        pomodoro: false,
      },
    });
    expect(next.mode).toBe('charts');
    expect(next.widgets.pomodoro).toBe(false);
    expect(next.widgets.docs).toBe(true);
  });

  it('round-trips through cookie encoding', () => {
    const prefs = normalizeProductivityDashboardPreferences({
      mode: 'productivity',
      widgets: {
        ...DEFAULT_PRODUCTIVITY_DASHBOARD_PREFERENCES.widgets,
        alice: false,
      },
    });
    const encoded = encodeProductivityDashboardPreferencesCookie(prefs);
    const parsed = parseProductivityDashboardPreferencesCookie(encoded);
    expect(productivityDashboardPreferencesEquals(prefs, parsed)).toBe(true);
  });
});
