import { cookies } from 'next/headers';
import {
  DEFAULT_PRODUCTIVITY_DASHBOARD_PREFERENCES,
  PRODUCTIVITY_DASHBOARD_PREFS_COOKIE,
  normalizeProductivityDashboardPreferences,
  parseProductivityDashboardPreferencesCookie,
  type ProductivityDashboardPreferences,
} from '@/app/dashboard/_helpers/productivity-dashboard-preferences';

export type ProductivityDashboardPreferencesBootstrap = {
  readonly preferences: ProductivityDashboardPreferences;
  readonly hasCookie: boolean;
};

export async function readProductivityDashboardPreferencesBootstrap(): Promise<ProductivityDashboardPreferencesBootstrap> {
  const jar = await cookies();
  const raw = jar.get(PRODUCTIVITY_DASHBOARD_PREFS_COOKIE)?.value;
  if (!raw) {
    return {
      preferences: normalizeProductivityDashboardPreferences(
        DEFAULT_PRODUCTIVITY_DASHBOARD_PREFERENCES
      ),
      hasCookie: false,
    };
  }

  return {
    preferences: parseProductivityDashboardPreferencesCookie(raw),
    hasCookie: true,
  };
}
