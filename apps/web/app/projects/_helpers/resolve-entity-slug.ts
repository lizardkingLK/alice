import { notFound, redirect } from 'next/navigation';
import { isUuidSegment } from '@/app/_shared/utility';
import { withProjectSearchParams } from '@/app/projects/_helpers/project-links';
import { projectScopedHref } from '@/app/projects/_helpers/project-tree-links';
import {
  getSprint,
  getSprintByProjectSlug,
} from '@/app/sprints/_services/sprints.reads.server';
import type { Sprint } from '@/app/sprints/_services/sprints.mutations.client';
import {
  getWorkItem,
  getWorkItemByProjectSlug,
} from '@/app/work-items/_services/work-items.reads.server';
import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';
import type { RawSearchParams } from '@/lib/search-params';

function normalizeSlugSegment(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Resolve `/projects/{KEY}/sprints/{sprintSlug}/…` — UUID segments redirect to
 * the canonical slug form under the same project tree.
 */
export async function resolveSprintSlugParam(params: {
  projectId: string;
  projectKey: string;
  rawSprintSlug: string;
  searchParams?: RawSearchParams;
  summaryReport?: boolean;
  workItemSlug?: string | null;
}): Promise<Sprint> {
  const {
    projectId,
    projectKey,
    rawSprintSlug,
    searchParams,
    summaryReport,
    workItemSlug,
  } = params;

  const redirectToCanonical = (sprintSlug: string): never => {
    redirect(
      withProjectSearchParams(
        projectScopedHref({
          projectKeyOrId: projectKey,
          area: workItemSlug ? 'work-items' : 'sprints',
          sprintSlug,
          workItemSlug,
          summaryReport,
        }),
        searchParams
      )
    );
  };

  if (isUuidSegment(rawSprintSlug)) {
    const sprint = await getSprint(rawSprintSlug);
    if (!sprint || sprint.project?.id !== projectId) {
      notFound();
    }
    redirectToCanonical(sprint.slug);
  }

  const slug = normalizeSlugSegment(rawSprintSlug);
  if (rawSprintSlug !== slug) {
    redirectToCanonical(slug);
  }

  const sprint = await getSprintByProjectSlug(projectId, slug);
  if (!sprint) {
    notFound();
  }

  return sprint;
}

/**
 * Resolve `/projects/{KEY}/work-items/{workItemSlug}` (and sprint-scoped form).
 * UUID segments redirect to the canonical slug path.
 */
export async function resolveWorkItemSlugParam(params: {
  projectId: string;
  projectKey: string;
  rawWorkItemSlug: string;
  searchParams?: RawSearchParams;
  sprintSlug?: string | null;
}): Promise<DbWorkItem> {
  const { projectId, projectKey, rawWorkItemSlug, searchParams, sprintSlug } =
    params;

  const redirectToCanonical = (workItemSlug: string): never => {
    redirect(
      withProjectSearchParams(
        projectScopedHref({
          projectKeyOrId: projectKey,
          area: 'work-items',
          workItemSlug,
          sprintSlug,
        }),
        searchParams
      )
    );
  };

  if (isUuidSegment(rawWorkItemSlug)) {
    const workItem = await getWorkItem(rawWorkItemSlug);
    if (workItem?.project_id !== projectId) {
      notFound();
    }
    redirectToCanonical(workItem.slug);
  }

  const slug = normalizeSlugSegment(rawWorkItemSlug);
  if (rawWorkItemSlug !== slug) {
    redirectToCanonical(slug);
  }

  const workItem = await getWorkItemByProjectSlug(projectId, slug);
  if (!workItem) {
    notFound();
  }

  return workItem;
}
