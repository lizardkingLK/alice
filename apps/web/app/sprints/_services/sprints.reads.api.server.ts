import {
  toDateOnly,
  type SprintRowWithProject as DbSprintRelation,
} from '@repo/types';
import { ApiError } from '@/lib/api/api-fetch.helper';
import { apiFetch } from '@/lib/api/api-fetch.reads.use.server';
import { asIso } from '@/lib/api/wire-date';
import {
  mapDbSprintToSprint,
  type PaginatedSprints,
  type Sprint,
} from './sprints.mutations.client';

/**
 * Align Express JSON (Prisma `Date` → ISO) with page types:
 * `start_date` / `end_date` are `YYYY-MM-DD`, audit timestamps stay ISO.
 */
export function mapSprintApiRow(row: Record<string, unknown>): Sprint {
  return mapDbSprintToSprint({
    ...row,
    start_date: toDateOnly(asIso(row.start_date)),
    end_date: toDateOnly(asIso(row.end_date)),
    created_at: asIso(row.created_at),
    updated_at: asIso(row.updated_at),
    updated_by: (row.updated_by as string | null | undefined) ?? null,
    created_by: (row.created_by as string | null | undefined) ?? null,
    goal: (row.goal as string | null | undefined) ?? null,
    summary_report: row.summary_report ?? null,
  } as unknown as DbSprintRelation);
}

/** Query string for `GET /api/sprints` (matches `listSprintsQuerySchema`). */
export function buildSprintsListSearchParams(input: {
  tab?: 'active' | 'archived';
  page: number;
  limit: number;
  search?: string;
  projectId?: string;
}): URLSearchParams {
  const params = new URLSearchParams();
  params.set('page', String(input.page));
  params.set('limit', String(input.limit));

  if (input.tab) {
    params.set('tab', input.tab);
  }

  const search = input.search?.trim();
  if (search) {
    params.set('search', search);
  }

  if (input.projectId) {
    params.set('projectId', input.projectId);
  }

  return params;
}

type SprintListApiResponse = {
  sprints: Record<string, unknown>[];
} & PaginatedSprints['pagination'];

/**
 * Optional RSC read path via Express GET (`DATA_READS_VIA_API` toggle).
 * Express scopes the list to the actor's accessible projects, so the
 * `projectIds` option is not forwarded.
 */
export async function listSprintsPaginatedFromApi(
  tab: 'active' | 'archived' | undefined,
  page: number,
  limit: number,
  search?: string,
  projectId?: string
): Promise<PaginatedSprints> {
  const params = buildSprintsListSearchParams({
    tab,
    page,
    limit,
    search,
    projectId,
  });
  const result = await apiFetch<SprintListApiResponse>(
    `/api/sprints?${params.toString()}`
  );

  return {
    sprints: result.sprints.map(mapSprintApiRow),
    pagination: {
      page: result.page,
      limit: result.limit,
      totalCount: result.totalCount,
      totalPages: result.totalPages,
    },
  };
}

export async function getSprintFromApi(
  sprintId: string
): Promise<Sprint | null> {
  try {
    const result = await apiFetch<{ data: Record<string, unknown> | null }>(
      `/api/sprints/${sprintId}`
    );
    return result.data ? mapSprintApiRow(result.data) : null;
  } catch (error) {
    // 403 mirrors Supabase RLS, which hides inaccessible sprints as null.
    if (error instanceof ApiError && [403, 404].includes(error.status)) {
      return null;
    }
    throw error;
  }
}
