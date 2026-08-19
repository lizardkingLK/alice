import { serializeWorkItemLabelsFilter, toDateOnly } from '@repo/types';
import { ApiError } from '@/lib/api/api';
import type {
  DbWorkItem,
  GetWorkItemsPaginatedResponse,
  WorkItemListFilters,
} from '@/app/work-items/_services/workItem.service.server';

/* eslint-disable no-unused-vars -- callback signature for injected server apiFetch */
type ApiFetch = <T>(path: string, init?: RequestInit) => Promise<T>;
/* eslint-enable no-unused-vars */

function asIso(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string') {
    return value;
  }
  return String(value);
}

function asDueDate(value: unknown): string | null {
  if (value == null || value === '') {
    return null;
  }
  return toDateOnly(asIso(value));
}

/** Align Express JSON (ISO dates) with the supabase-js `DbWorkItem` shape. */
export function mapWorkItemApiRow(row: Record<string, unknown>): DbWorkItem {
  return {
    ...row,
    due_date: asDueDate(row.due_date),
    done_at: row.done_at == null ? null : asIso(row.done_at),
    created_at: asIso(row.created_at),
    updated_at: asIso(row.updated_at),
  } as unknown as DbWorkItem;
}

function setNullableId(
  params: URLSearchParams,
  key: string,
  value: string | null | undefined
): void {
  if (value === null) {
    params.set(key, 'null');
    return;
  }
  if (value) {
    params.set(key, value);
  }
}

/** Query string for `GET /api/workItems` (matches `listWorkItemsQuerySchema`). */
export function buildWorkItemsListSearchParams(input: {
  page: number;
  limit: number;
  search?: string;
  filters?: WorkItemListFilters;
}): URLSearchParams {
  const params = new URLSearchParams();
  params.set('page', String(input.page));
  params.set('limit', String(input.limit));

  const search = input.search?.trim();
  if (search) {
    params.set('search', search);
  }

  const filters = input.filters;
  if (!filters) {
    return params;
  }

  if (filters.projectId) {
    params.set('projectId', filters.projectId);
  }
  setNullableId(params, 'sprintId', filters.sprintId);
  setNullableId(params, 'parentId', filters.parentId);
  if (filters.type) {
    params.set('type', filters.type);
  }
  if (filters.assigneeId) {
    params.set('assigneeId', filters.assigneeId);
  }
  if (filters.labels?.length) {
    const labels = serializeWorkItemLabelsFilter(filters.labels);
    if (labels) {
      params.set('labels', labels);
    }
  }

  return params;
}

export async function listWorkItemsPaginatedFromApi(
  apiFetch: ApiFetch,
  page: number,
  limit: number,
  search?: string,
  filters?: WorkItemListFilters
): Promise<GetWorkItemsPaginatedResponse> {
  const params = buildWorkItemsListSearchParams({
    page,
    limit,
    search,
    filters,
  });
  const result = await apiFetch<GetWorkItemsPaginatedResponse>(
    `/api/workItems?${params.toString()}`
  );

  return {
    ...result,
    workItems: result.workItems.map((row) =>
      mapWorkItemApiRow(row as unknown as Record<string, unknown>)
    ),
  };
}

export async function getWorkItemFromApi(
  apiFetch: ApiFetch,
  workItemId: string
): Promise<DbWorkItem | null> {
  try {
    const result = await apiFetch<{ data: Record<string, unknown> | null }>(
      `/api/workItems/${workItemId}`
    );
    if (!result.data) {
      return null;
    }
    return mapWorkItemApiRow(result.data);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}
