/**
 * Per-user Overview mode + productivity widget visibility.
 * Browser localStorage + cookie (SSR bootstrap). Does not sync across devices.
 */

import { getLocalStorageJson, setLocalStorageJson } from '@/lib/local-storage';

export const PRODUCTIVITY_DASHBOARD_PREFS_COOKIE =
  'alice_overview_productivity_prefs_v1';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const STORAGE_PREFIX = 'alice:overview-productivity-prefs:v1:';
export const PRODUCTIVITY_LAYOUT_STORAGE_KEY =
  'alice.dashboard.productivity.layout.v1';

export const OVERVIEW_MODES = ['charts', 'productivity'] as const;
export type OverviewMode = (typeof OVERVIEW_MODES)[number];

export const PRODUCTIVITY_WIDGET_IDS = [
  'my-work-assigned',
  'my-work-pending-stories',
  'my-work-in-progress',
  'projects',
  'alice',
  'docs',
  'pomodoro',
] as const;

export type ProductivityWidgetId = (typeof PRODUCTIVITY_WIDGET_IDS)[number];

export type ProductivityDashboardPreferences = {
  readonly mode: OverviewMode;
  readonly widgets: Readonly<Record<ProductivityWidgetId, boolean>>;
};

export const DEFAULT_PRODUCTIVITY_DASHBOARD_PREFERENCES: ProductivityDashboardPreferences =
  {
    mode: 'productivity',
    widgets: {
      'my-work-assigned': true,
      'my-work-pending-stories': true,
      'my-work-in-progress': true,
      projects: true,
      alice: true,
      docs: true,
      pomodoro: true,
    },
  };

export const PRODUCTIVITY_WIDGET_LABELS: Record<ProductivityWidgetId, string> = {
  'my-work-assigned': 'Assigned to you',
  'my-work-pending-stories': 'Pending stories',
  'my-work-in-progress': 'In progress',
  projects: 'Your projects',
  alice: 'Alice',
  docs: 'Docs',
  pomodoro: 'Pomodoro',
};

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

function isOverviewMode(value: unknown): value is OverviewMode {
  return (
    typeof value === 'string' &&
    (OVERVIEW_MODES as readonly string[]).includes(value)
  );
}

function asBooleanRecord(
  value: unknown,
  defaults: Readonly<Record<ProductivityWidgetId, boolean>>
): Record<ProductivityWidgetId, boolean> {
  const source =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const next = { ...defaults };
  for (const key of PRODUCTIVITY_WIDGET_IDS) {
    if (typeof source[key] === 'boolean') {
      next[key] = source[key];
    }
  }
  return next;
}

export function normalizeProductivityDashboardPreferences(
  value: unknown
): ProductivityDashboardPreferences {
  const source =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return {
    mode: isOverviewMode(source.mode)
      ? source.mode
      : DEFAULT_PRODUCTIVITY_DASHBOARD_PREFERENCES.mode,
    widgets: asBooleanRecord(
      source.widgets,
      DEFAULT_PRODUCTIVITY_DASHBOARD_PREFERENCES.widgets
    ),
  };
}

function cloneDefaults(): ProductivityDashboardPreferences {
  return normalizeProductivityDashboardPreferences(
    DEFAULT_PRODUCTIVITY_DASHBOARD_PREFERENCES
  );
}

export function encodeProductivityDashboardPreferencesCookie(
  prefs: ProductivityDashboardPreferences
): string {
  return encodeURIComponent(
    JSON.stringify(normalizeProductivityDashboardPreferences(prefs))
  );
}

export function parseProductivityDashboardPreferencesCookie(
  raw: string | undefined | null
): ProductivityDashboardPreferences {
  if (!raw) {
    return cloneDefaults();
  }
  try {
    return normalizeProductivityDashboardPreferences(
      JSON.parse(decodeURIComponent(raw)) as unknown
    );
  } catch {
    try {
      return normalizeProductivityDashboardPreferences(
        JSON.parse(raw) as unknown
      );
    } catch {
      return cloneDefaults();
    }
  }
}

function writeCookie(prefs: ProductivityDashboardPreferences): void {
  if (typeof document === 'undefined') {
    return;
  }
  const value = encodeProductivityDashboardPreferencesCookie(prefs);
  document.cookie = [
    `${PRODUCTIVITY_DASHBOARD_PREFS_COOKIE}=${value}`,
    'path=/',
    `max-age=${COOKIE_MAX_AGE_SECONDS}`,
    'SameSite=Lax',
  ].join('; ');
}

export function readProductivityDashboardPreferencesLocal(
  userId: string | null | undefined
): ProductivityDashboardPreferences | null {
  if (!userId) {
    return null;
  }
  const raw = getLocalStorageJson(storageKey(userId));
  if (raw == null) {
    return null;
  }
  return normalizeProductivityDashboardPreferences(raw);
}

export function writeProductivityDashboardPreferences(
  userId: string | null | undefined,
  prefs: ProductivityDashboardPreferences
): void {
  const normalized = normalizeProductivityDashboardPreferences(prefs);
  writeCookie(normalized);
  if (!userId) {
    return;
  }
  setLocalStorageJson(storageKey(userId), normalized);
}

export function productivityDashboardPreferencesEquals(
  left: ProductivityDashboardPreferences,
  right: ProductivityDashboardPreferences
): boolean {
  if (left.mode !== right.mode) {
    return false;
  }
  return PRODUCTIVITY_WIDGET_IDS.every(
    (id) => left.widgets[id] === right.widgets[id]
  );
}
