import type { DashboardBreadcrumbOverride } from '@/app/dashboard/_components/dashboard-breadcrumb';
import type { ProjectDetailsTab, RawSearchParams } from '@/lib/search-params';
import {
  projectScopedHref,
  type ProjectTreeArea,
} from '@/app/projects/_helpers/project-tree-links';

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

/**
 * Canonical project workspace path segment: uppercase key when the value looks
 * like a key; otherwise pass through (UUID links still resolve via redirect).
 */
function projectPathSegment(projectKeyOrId: string): string {
  if (looksLikeProjectKey(projectKeyOrId)) {
    return normalizeProjectKey(projectKeyOrId);
  }
  return projectKeyOrId.trim();
}

/** Canonical page path: `/projects/{KEY}` (Jira-style). */
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

/** Append/merge raw page search params when redirecting between project path forms. */
export function withProjectSearchParams(
  href: string,
  searchParams?: RawSearchParams
): string {
  if (!searchParams) {
    return href;
  }

  const questionIndex = href.indexOf('?');
  const path = questionIndex >= 0 ? href.slice(0, questionIndex) : href;
  const existingQuery = questionIndex >= 0 ? href.slice(questionIndex + 1) : '';
  const query = new URLSearchParams(existingQuery);

  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === 'string' && value.length > 0) {
      query.set(key, value);
    }
  }

  const serialized = query.toString();
  if (!serialized) {
    return path;
  }

  return `${path}?${serialized}`;
}

/**
 * In-app project workspace href. Prefer the project **key** so the address bar
 * stays shareable; UUID values still work and redirect to the key URL.
 */
export function projectDetailHref(
  projectKeyOrId: string,
  tab?: ProjectDetailsTab
): string {
  const segment = projectPathSegment(projectKeyOrId);
  if (tab && tab !== 'details') {
    return `/projects/${segment}?tab=${tab}`;
  }
  return `/projects/${segment}`;
}

/** Sidebar links for board / backlog / my work (always nested paths). */
export function projectTreeNavHref(
  projectKeyOrId: string,
  area: Extract<ProjectTreeArea, 'board' | 'backlog' | 'member'>
): string {
  return projectScopedHref({ projectKeyOrId, area });
}

export function buildProjectBreadcrumbOverrides(
  projectKeyOrId: string,
  projectName?: string
): DashboardBreadcrumbOverride[] {
  const href = projectDetailHref(projectKeyOrId);
  return [
    { label: 'Dashboard', url: '/dashboard' },
    { label: 'Projects', url: '/projects' },
    {
      label: projectName || projectPathSegment(projectKeyOrId),
      url: href,
    },
  ];
}
