import { notFound, redirect } from 'next/navigation';
import { isUuidSegment } from '@/app/_shared/utility';
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
import {
  appendSearchParams,
  buildGlobalFilterHref,
  stripEntityFilterParams,
  type GlobalFilterArea,
} from '@/app/board/_helpers/global-filter-href';
import type { RawSearchParams } from '@/lib/search-params';

function rawSearchToParams(searchParams?: RawSearchParams): URLSearchParams {
  const params = new URLSearchParams();
  if (!searchParams) {
    return params;
  }
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === 'string' && value.length > 0) {
      params.set(key, value);
    }
  }
  return params;
}

export type ResolvedGlobalFilterPath = {
  readonly projectId: string;
  readonly projectKey: string;
  readonly sprintId?: string;
  readonly sprintSlug?: string;
  readonly injectedSearchParams: RawSearchParams;
};

function redirectGlobalFilterCanonical(params: {
  readonly area: GlobalFilterArea;
  readonly projectKey: string;
  readonly sprintSlug?: string | null;
  readonly rest: URLSearchParams;
}): never {
  redirect(
    appendSearchParams(
      buildGlobalFilterHref({
        area: params.area,
        projectKey: params.projectKey,
        sprintSlug: params.sprintSlug,
      }),
      params.rest
    )
  );
}

async function resolveSprintForGlobalFilter(params: {
  readonly area: GlobalFilterArea;
  readonly projectId: string;
  readonly projectKey: string;
  readonly rawSprintSlug?: string | null;
  readonly rest: URLSearchParams;
}): Promise<{ readonly sprintId?: string; readonly sprintSlug?: string }> {
  const { area, projectId, projectKey, rawSprintSlug, rest } = params;

  if (!rawSprintSlug || (area !== 'board' && area !== 'work-items')) {
    return {};
  }

  if (isUuidSegment(rawSprintSlug)) {
    const sprint = await getSprint(rawSprintSlug);
    if (!sprint || sprint.project?.id !== projectId) {
      notFound();
    }
    redirectGlobalFilterCanonical({
      area,
      projectKey,
      sprintSlug: sprint.slug,
      rest,
    });
  }

  const normalizedSlug = rawSprintSlug.trim().toLowerCase();
  if (rawSprintSlug !== normalizedSlug) {
    redirectGlobalFilterCanonical({
      area,
      projectKey,
      sprintSlug: normalizedSlug,
      rest,
    });
  }

  const sprint = await getSprintByProjectSlug(projectId, normalizedSlug);
  if (!sprint) {
    notFound();
  }

  return { sprintId: sprint.id, sprintSlug: sprint.slug };
}

/**
 * Resolve `/board|backlog|member|work-items/projects/{KEY}/…` path segments
 * into UUID filters for existing data loaders. UUID / non-canonical KEY
 * redirect to KEY.
 */
export async function resolveGlobalFilterPath(params: {
  area: GlobalFilterArea;
  rawProjectKey: string;
  rawSprintSlug?: string | null;
  searchParams?: RawSearchParams;
}): Promise<ResolvedGlobalFilterPath> {
  const { area, rawProjectKey, rawSprintSlug, searchParams } = params;
  const rest = stripEntityFilterParams(rawSearchToParams(searchParams));

  if (isUuidSegment(rawProjectKey)) {
    const project = await safeServerFetch(
      getProject(rawProjectKey),
      null,
      'resolve global filter project from uuid'
    );
    if (!project) {
      notFound();
    }
    redirectGlobalFilterCanonical({
      area,
      projectKey: project.key,
      sprintSlug: rawSprintSlug,
      rest,
    });
  }

  if (!looksLikeProjectKey(rawProjectKey)) {
    notFound();
  }

  const projectKey = normalizeProjectKey(rawProjectKey);
  if (rawProjectKey !== projectKey) {
    redirectGlobalFilterCanonical({
      area,
      projectKey,
      sprintSlug: rawSprintSlug,
      rest,
    });
  }

  const projectId = await safeServerFetch(
    getProjectIdByKey(projectKey),
    null,
    'resolve global filter project id from key'
  );
  if (!projectId) {
    notFound();
  }

  const { sprintId, sprintSlug } = await resolveSprintForGlobalFilter({
    area,
    projectId,
    projectKey,
    rawSprintSlug,
    rest,
  });

  const injected: RawSearchParams = {
    ...(searchParams ?? {}),
    project: projectId,
  };
  delete injected.sprint;
  if (sprintId) {
    injected.sprint = sprintId;
  }

  return {
    projectId,
    projectKey,
    sprintId,
    sprintSlug,
    injectedSearchParams: injected,
  };
}
