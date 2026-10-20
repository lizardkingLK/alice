import { toDateOnly } from '@repo/types';
import { ApiError } from '@/lib/api/api-fetch.helper';
import { apiFetch } from '@/lib/api/api-fetch.reads.use.server';
import { asIso, asNullableIso } from '@/lib/api/wire-date';
import {
  ProjectStatusEnum,
  type ProjectStatusTab,
} from '@/app/projects/_helpers/project-status';
import type {
  GetProjectsPaginatedResponse,
  Project,
  ProjectMemberWithUser,
} from '@/app/projects/_services/projects.mutations.shared';

function asDateOnly(value: unknown): string | null {
  if (value == null || value === '') {
    return null;
  }
  return toDateOnly(asIso(value));
}

/**
 * Align Express JSON (Prisma ISO dates) with the PostgREST row shape the
 * pages already consume: `date` columns stay `YYYY-MM-DD`.
 */
export function mapProjectApiRow(row: Record<string, unknown>): Project {
  return {
    ...row,
    start_date: asDateOnly(row.start_date),
    end_date: asDateOnly(row.end_date),
    created_at: asIso(row.created_at),
    updated_at: asIso(row.updated_at),
    deleted_at: asNullableIso(row.deleted_at),
  } as unknown as Project;
}

export function mapProjectMemberApiRow(
  row: Record<string, unknown>
): ProjectMemberWithUser {
  return {
    ...row,
    created_at: asIso(row.created_at),
  } as unknown as ProjectMemberWithUser;
}

/** Query string for `GET /api/projects` (matches `listProjectsQuerySchema`). */
export function buildProjectsListSearchParams(input: {
  page: number;
  limit: number;
  status?: ProjectStatusTab;
  search?: string;
}): URLSearchParams {
  const params = new URLSearchParams();
  params.set('page', String(input.page));
  params.set('limit', String(input.limit));
  params.set('status', input.status ?? ProjectStatusEnum.active);

  const search = input.search?.trim();
  if (search) {
    params.set('search', search);
  }

  return params;
}

/** Optional RSC read path via Express GET (`DATA_READS_VIA_API` toggle). */
export async function getProjectListPaginatedFromApi(
  page: number,
  limit: number,
  status?: ProjectStatusTab,
  search?: string
): Promise<GetProjectsPaginatedResponse> {
  const params = buildProjectsListSearchParams({
    page,
    limit,
    status,
    search,
  });
  const result = await apiFetch<GetProjectsPaginatedResponse>(
    `/api/projects?${params.toString()}`
  );

  return {
    ...result,
    projects: result.projects.map((row) =>
      mapProjectApiRow(row as unknown as Record<string, unknown>)
    ),
  };
}

/**
 * `GET /api/projects/:id`. Mirrors the Supabase twin, which throws when the
 * project is missing — a 404 surfaces as `ApiError` for `safeServerFetch`.
 */
export async function getProjectFromApi(id: string): Promise<Project> {
  const result = await apiFetch<{ data: Record<string, unknown> | null }>(
    `/api/projects/${id}`
  );
  if (!result.data) {
    throw new ApiError('Project not found', 404);
  }
  return mapProjectApiRow(result.data);
}

export async function getProjectMembersFromApi(
  projectId: string
): Promise<ProjectMemberWithUser[]> {
  const result = await apiFetch<{ members: Record<string, unknown>[] }>(
    `/api/projects/${projectId}/members`
  );

  return result.members
    .map(mapProjectMemberApiRow)
    .filter((member) => member.status === 'active' && member.user);
}
