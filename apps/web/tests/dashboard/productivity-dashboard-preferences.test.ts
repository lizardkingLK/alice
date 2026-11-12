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
    expect(DEFAULT_PRODUCTIVITY_DASHBOARD_PREFERENCES.widgets.alice).toBe(
      false
    );
    expect(DEFAULT_PRODUCTIVITY_DASHBOARD_PREFERENCES.widgets.pomodoro).toBe(
      true
    );
    expect(
      DEFAULT_PRODUCTIVITY_DASHBOARD_PREFERENCES.widgets['my-work-categories']
    ).toBe(false);
    expect(DEFAULT_PRODUCTIVITY_DASHBOARD_PREFERENCES.widgets.docs).toBe(false);
  });

  it('keeps known mode and widget flags', () => {
    const next = normalizeProductivityDashboardPreferences({
      mode: 'charts',
      widgets: {
        ...DEFAULT_PRODUCTIVITY_DASHBOARD_PREFERENCES.widgets,
        pomodoro: false,
        docs: true,
        'my-work-categories': true,
      },
    });
    expect(next.mode).toBe('charts');
    expect(next.widgets.pomodoro).toBe(false);
    expect(next.widgets.docs).toBe(true);
    expect(next.widgets['my-work-categories']).toBe(true);
    expect(next.widgets.alice).toBe(false);
  });

  it('migrates legacy KPI toggles into Categories', () => {
    const next = normalizeProductivityDashboardPreferences({
      mode: 'productivity',
      widgets: {
        ...DEFAULT_PRODUCTIVITY_DASHBOARD_PREFERENCES.widgets,
        'my-work-assigned': true,
      },
    });
    expect(next.widgets['my-work-categories']).toBe(true);
  });

  it('round-trips through cookie encoding', () => {
    const prefs = normalizeProductivityDashboardPreferences({
      mode: 'productivity',
      widgets: {
        ...DEFAULT_PRODUCTIVITY_DASHBOARD_PREFERENCES.widgets,
        alice: true,
      },
    });
    const encoded = encodeProductivityDashboardPreferencesCookie(prefs);
    const parsed = parseProductivityDashboardPreferencesCookie(encoded);
    expect(productivityDashboardPreferencesEquals(prefs, parsed)).toBe(true);
  });
});
