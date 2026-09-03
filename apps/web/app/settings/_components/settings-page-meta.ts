import type { DashboardBreadcrumbOverride } from '@/app/dashboard/_components/dashboard-breadcrumb';

/** Canonical settings entry (General tab). Direct `/settings` also resolves here. */
export const SETTINGS_GENERAL_HREF = '/settings?tab=general';

export const SETTINGS_BREADCRUMBS: DashboardBreadcrumbOverride[] = [
  { label: 'Dashboard', url: '/dashboard' },
  { label: 'Settings', url: SETTINGS_GENERAL_HREF },
];
