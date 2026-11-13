import {
  normalizeProjectKey,
  looksLikeProjectKey,
  projectShareHref,
} from '@/app/projects/_helpers/project-links';

function projectPathSegment(projectKeyOrId: string): string {
  if (looksLikeProjectKey(projectKeyOrId)) {
    return normalizeProjectKey(projectKeyOrId);
  }
  return projectKeyOrId.trim();
}

export type ProjectTreeArea =
  'details' | 'board' | 'backlog' | 'member' | 'work-items' | 'sprints';

/**
 * Canonical in-project path tree under `/projects/{KEY}/…`.
 * Prefer project KEY + entity slugs in the address bar.
 */
export function projectScopedHref(params: {
  projectKeyOrId: string;
  area?: ProjectTreeArea;
  sprintSlug?: string | null;
  workItemSlug?: string | null;
  /** Sprint summary report segment (kebab). */
  summaryReport?: boolean;
}): string {
  const root = `/projects/${projectPathSegment(params.projectKeyOrId)}`;
  const area = params.area ?? 'details';

  if (area === 'details') {
    return root;
  }

  if (area === 'board' || area === 'backlog' || area === 'member') {
    return `${root}/${area}`;
  }

  if (area === 'work-items') {
    if (params.sprintSlug && params.workItemSlug) {
      return `${root}/sprints/${params.sprintSlug}/work-items/${params.workItemSlug}`;
    }
    if (params.workItemSlug) {
      return `${root}/work-items/${params.workItemSlug}`;
    }
    return `${root}/work-items`;
  }

  if (area === 'sprints') {
    if (params.sprintSlug && params.summaryReport) {
      return `${root}/sprints/${params.sprintSlug}/summary-report`;
    }
    if (params.sprintSlug) {
      return `${root}/sprints/${params.sprintSlug}`;
    }
    return `${root}/sprints`;
  }

  return root;
}

/** Global board with project filter moved into the path. */
export function globalBoardHref(params?: {
  projectKey?: string | null;
  sprintSlug?: string | null;
}): string {
  const key = params?.projectKey?.trim();
  if (!key) {
    return '/board';
  }
  const projectSeg = projectPathSegment(key);
  if (params?.sprintSlug) {
    return `/board/projects/${projectSeg}/sprints/${params.sprintSlug}`;
  }
  return `/board/projects/${projectSeg}`;
}

/** Global backlog with project filter in the path. */
export function globalBacklogHref(params?: {
  projectKey?: string | null;
}): string {
  const key = params?.projectKey?.trim();
  if (!key) {
    return '/backlog';
  }
  return `/backlog/projects/${projectPathSegment(key)}`;
}

/** Global My Work with optional project path filter. */
export function globalMemberHref(params?: {
  projectKey?: string | null;
}): string {
  const key = params?.projectKey?.trim();
  if (!key) {
    return '/member';
  }
  return `/member/projects/${projectPathSegment(key)}`;
}

/** Global Work Items with project KEY (+ optional sprint slug) in the path. */
export function globalWorkItemsHref(params?: {
  projectKey?: string | null;
  sprintSlug?: string | null;
}): string {
  const key = params?.projectKey?.trim();
  if (!key) {
    return '/work-items';
  }
  const projectSeg = projectPathSegment(key);
  if (params?.sprintSlug) {
    return `/work-items/projects/${projectSeg}/sprints/${params.sprintSlug}`;
  }
  return `/work-items/projects/${projectSeg}`;
}

/** @deprecated Prefer projectScopedHref — kept for gradual call-site migration. */
export function projectHubHref(projectKey: string): string {
  return projectShareHref(projectKey);
}
