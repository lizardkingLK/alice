import { notFound, redirect } from 'next/navigation';
import {
  isProjectUuid,
  looksLikeProjectKey,
  normalizeProjectKey,
  projectDetailHref,
  withProjectSearchParams,
} from '@/app/projects/_helpers/project-links';
import { projectScopedHref } from '@/app/projects/_helpers/project-tree-links';
import {
  getProject,
  getProjectIdByKey,
  type Project,
} from '@/app/projects/_services/projects.reads.server';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import type { RawSearchParams } from '@/lib/search-params';

export type ResolvedProjectPath = {
  readonly project: Project;
  readonly projectKey: string;
};

/**
 * Resolve `/projects/[id]/…` param to a project row. UUID / non-canonical KEY
 * redirect to the KEY form under the same nested area.
 */
export async function resolveProjectPathParam(params: {
  rawParam: string;
  area: 'details' | 'board' | 'backlog' | 'member' | 'work-items' | 'sprints';
  searchParams?: RawSearchParams;
  sprintSlug?: string | null;
  workItemSlug?: string | null;
  summaryReport?: boolean;
}): Promise<ResolvedProjectPath> {
  const {
    rawParam,
    area,
    searchParams,
    sprintSlug,
    workItemSlug,
    summaryReport,
  } = params;

  const redirectToCanonical = (key: string): never => {
    const href = projectScopedHref({
      projectKeyOrId: key,
      area,
      sprintSlug,
      workItemSlug,
      summaryReport,
    });
    redirect(withProjectSearchParams(href, searchParams));
  };

  if (isProjectUuid(rawParam)) {
    const projectById = await safeServerFetch(
      getProject(rawParam),
      null,
      'load project for nested key redirect'
    );
    if (!projectById) {
      notFound();
    }
    redirectToCanonical(projectById.key);
  }

  if (!looksLikeProjectKey(rawParam)) {
    notFound();
  }

  const canonicalKey = normalizeProjectKey(rawParam);
  if (rawParam !== canonicalKey) {
    redirectToCanonical(canonicalKey);
  }

  const projectId = await safeServerFetch(
    getProjectIdByKey(canonicalKey),
    null,
    'resolve nested project id from key'
  );
  if (!projectId) {
    notFound();
  }

  const project = await safeServerFetch(
    getProject(projectId),
    null,
    'load nested project'
  );
  if (!project) {
    notFound();
  }

  return { project, projectKey: canonicalKey };
}

/** Hub-only redirect helper (details area). */
export function projectDetailsCanonicalHref(
  key: string,
  searchParams?: RawSearchParams
): string {
  return withProjectSearchParams(projectDetailHref(key), searchParams);
}
