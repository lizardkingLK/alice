import type { DashboardBreadcrumbOverride } from '@/app/dashboard/_components/dashboard-breadcrumb';
import type { ProjectDetailsTab, RawSearchParams } from '@/lib/search-params';

const PROJECT_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Matches stored project keys (`^[A-Z0-9]{2,10}$`), case-insensitive for URL input. */
const PROJECT_KEY_RE = /^[A-Z0-9]{2,10}$/i;

export function isProjectUuid(value: string): boolean {
  return PROJECT_UUID_RE.test(value);
}

export function looksLikeProjectKey(value: string): boolean {
  return PROJECT_KEY_RE.test(value);
}

/** Normalize a share/URL key to the uppercase form stored in the DB. */
export function normalizeProjectKey(value: string): string {
  return value.trim().toUpperCase();
}

/** Jira-style share path: `/projects/{KEY}`. */
export function projectShareHref(projectKey: string): string {
  return `/projects/${normalizeProjectKey(projectKey)}`;
}

export function buildProjectShareUrl(
  origin: string,
  projectKey: string
): string {
  const base = origin.replace(/\/$/, '');
  return `${base}${projectShareHref(projectKey)}`;
}

/** Append raw page search params when redirecting key → UUID. */
export function withProjectSearchParams(
  href: string,
  searchParams?: RawSearchParams
): string {
  if (!searchParams) {
    return href;
  }

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === 'string' && value.length > 0) {
      query.set(key, value);
    }
  }

  const serialized = query.toString();
  if (!serialized) {
    return href;
  }

  return `${href}?${serialized}`;
}

export function projectDetailHref(
  projectId: string,
  tab?: ProjectDetailsTab
): string {
  if (tab && tab !== 'details') {
    return `/projects/${projectId}?tab=${tab}`;
  }
  return `/projects/${projectId}`;
}

export function buildProjectBreadcrumbOverrides(
  projectId: string,
  projectName?: string
): DashboardBreadcrumbOverride[] {
  return [
    { label: 'Dashboard', url: '/dashboard' },
    { label: 'Projects', url: '/projects' },
    {
      label: projectName || projectId,
      url: `/projects/${projectId}`,
    },
  ];
}
