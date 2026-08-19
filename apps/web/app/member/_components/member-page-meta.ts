import type { DashboardBreadcrumbOverride } from '@/app/dashboard/_components/dashboard-breadcrumb';
import { REGISTRY_PAGES } from '@/components/registry-page-shell';

export const MEMBER_PAGE_DESCRIPTION = 'Issues and tasks assigned to you.';

export const MEMBER_BREADCRUMBS: DashboardBreadcrumbOverride[] = [
  { label: 'Dashboard', url: '/dashboard' },
  { label: 'My Work', url: '/member' },
];

/** Sync Suspense fallback; `loading.tsx` overrides column count from the cookie. */
export const MEMBER_PAGE_SKELETON = REGISTRY_PAGES.workItems.skeleton;
