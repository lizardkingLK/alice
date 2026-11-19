import {
  globalBacklogHref,
  globalBoardHref,
  globalMemberHref,
  globalWorkItemsHref,
} from '@/app/projects/_helpers/project-tree-links';
import { ALL_PROJECTS_ID } from '@/app/board/_helpers/board-defaults-storage';

export type GlobalFilterArea = 'board' | 'backlog' | 'member' | 'work-items';

const STRIP_KEYS = new Set(['project', 'sprint']);

const GLOBAL_FILTER_ROOT_HREF: Record<GlobalFilterArea, string> = {
  board: '/board',
  backlog: '/backlog',
  member: '/member',
  'work-items': '/work-items',
};

function globalFilterRootHref(area: GlobalFilterArea): string {
  return GLOBAL_FILTER_ROOT_HREF[area];
}

/** Drop entity filter keys that now live in the path. */
export function stripEntityFilterParams(
  params: URLSearchParams
): URLSearchParams {
  const next = new URLSearchParams(params.toString());
  for (const key of STRIP_KEYS) {
    next.delete(key);
  }
  return next;
}

export function appendSearchParams(
  href: string,
  params: URLSearchParams
): string {
  const serialized = params.toString();
  if (!serialized) {
    return href;
  }
  return `${href}?${serialized}`;
}

/**
 * Canonical global workspace URL: path carries project KEY (+ sprint slug on
 * board); remaining filters stay as query.
 */
export function buildGlobalFilterHref(options: {
  readonly area: GlobalFilterArea;
  readonly projectKey?: string | null;
  readonly sprintSlug?: string | null;
  readonly searchParams?: URLSearchParams;
}): string {
  const rest = options.searchParams
    ? stripEntityFilterParams(options.searchParams)
    : new URLSearchParams();

  const key = options.projectKey?.trim();
  if (!key || key === ALL_PROJECTS_ID) {
    return appendSearchParams(globalFilterRootHref(options.area), rest);
  }

  if (options.area === 'board') {
    return appendSearchParams(
      globalBoardHref({
        projectKey: key,
        sprintSlug: options.sprintSlug,
      }),
      rest
    );
  }

  if (options.area === 'work-items') {
    return appendSearchParams(
      globalWorkItemsHref({
        projectKey: key,
        sprintSlug: options.sprintSlug,
      }),
      rest
    );
  }

  if (options.area === 'backlog') {
    return appendSearchParams(globalBacklogHref({ projectKey: key }), rest);
  }

  return appendSearchParams(globalMemberHref({ projectKey: key }), rest);
}

export function projectKeyForId(
  projects: readonly { readonly id: string; readonly key?: string | null }[],
  projectId: string | null | undefined
): string | null {
  if (!projectId || projectId === ALL_PROJECTS_ID) {
    return null;
  }
  const match = projects.find((project) => project.id === projectId);
  return match?.key?.trim() || null;
}

export function sprintSlugForId(
  sprints: readonly {
    readonly id: string;
    readonly slug?: string | null;
  }[],
  sprintId: string | null | undefined
): string | null {
  if (!sprintId || sprintId === ALL_PROJECTS_ID) {
    return null;
  }
  const match = sprints.find((sprint) => sprint.id === sprintId);
  return match?.slug?.trim() || null;
}
