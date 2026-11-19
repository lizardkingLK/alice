import { redirect } from 'next/navigation';
import { isUuidSegment } from '@/app/_shared/utility';
import { ALL_PROJECTS_ID } from '@/app/board/_helpers/board-defaults-storage';
import {
  appendSearchParams,
  buildGlobalFilterHref,
  stripEntityFilterParams,
  type GlobalFilterArea,
} from '@/app/board/_helpers/global-filter-href';
import {
  looksLikeProjectKey,
  normalizeProjectKey,
} from '@/app/projects/_helpers/project-links';
import {
  getProject,
  getProjectIdByKey,
} from '@/app/projects/_services/projects.reads.server';
import {
  getSprint,
  getSprintByProjectSlug,
} from '@/app/sprints/_services/sprints.reads.server';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import type { RawSearchParams } from '@/lib/search-params';

function firstString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function copyNonEntitySearchParams(
  searchParams: RawSearchParams
): URLSearchParams {
  const rest = stripEntityFilterParams(new URLSearchParams());
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === 'project' || key === 'sprint') {
      continue;
    }
    if (typeof value === 'string' && value.length > 0) {
      rest.set(key, value);
    }
  }
  return rest;
}

async function resolveLegacyProjectRef(projectRaw: string): Promise<{
  readonly projectKey: string;
  readonly projectId: string;
} | null> {
  if (isUuidSegment(projectRaw)) {
    const project = await safeServerFetch(
      getProject(projectRaw),
      null,
      'legacy filter project uuid'
    );
    if (!project) {
      return null;
    }
    return { projectKey: project.key, projectId: project.id };
  }

  if (!looksLikeProjectKey(projectRaw)) {
    return null;
  }

  const projectKey = normalizeProjectKey(projectRaw);
  const projectId = await safeServerFetch(
    getProjectIdByKey(projectKey),
    null,
    'legacy filter project key'
  );
  if (!projectId) {
    return null;
  }

  return { projectKey, projectId };
}

async function resolveLegacySprintSlug(params: {
  readonly area: GlobalFilterArea;
  readonly projectId: string;
  readonly sprintRaw: string | undefined;
}): Promise<string | null> {
  const { area, projectId, sprintRaw } = params;
  if (!sprintRaw || (area !== 'board' && area !== 'work-items')) {
    return null;
  }

  if (isUuidSegment(sprintRaw)) {
    const sprint = await getSprint(sprintRaw);
    if (sprint?.project?.id === projectId) {
      return sprint.slug;
    }
    return null;
  }

  const sprint = await getSprintByProjectSlug(
    projectId,
    sprintRaw.toLowerCase()
  );
  return sprint?.slug ?? null;
}

/**
 * When `/board|/backlog|/member|/work-items?project=` still carries entity
 * filters, 308 to the path-param form (`/board/projects/{KEY}/…`).
 * `project=all` stays on the root with query cleaned of sprint.
 */
export async function redirectLegacyGlobalFilterQuery(params: {
  area: GlobalFilterArea;
  searchParams: RawSearchParams;
}): Promise<void> {
  const { area, searchParams } = params;
  const projectRaw = firstString(searchParams.project)?.trim();
  if (!projectRaw || projectRaw === ALL_PROJECTS_ID) {
    return;
  }

  const resolvedProject = await resolveLegacyProjectRef(projectRaw);
  if (!resolvedProject) {
    return;
  }

  const sprintSlug = await resolveLegacySprintSlug({
    area,
    projectId: resolvedProject.projectId,
    sprintRaw: firstString(searchParams.sprint)?.trim(),
  });

  redirect(
    appendSearchParams(
      buildGlobalFilterHref({
        area,
        projectKey: resolvedProject.projectKey,
        sprintSlug,
      }),
      copyNonEntitySearchParams(searchParams)
    )
  );
}
