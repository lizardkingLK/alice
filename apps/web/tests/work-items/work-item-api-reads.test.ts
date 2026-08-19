import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/api';
import {
  buildWorkItemsListSearchParams,
  getWorkItemFromApi,
  listWorkItemsPaginatedFromApi,
  mapWorkItemApiRow,
} from '@/app/work-items/_helpers/work-item-api-reads';
import { workItemFactory } from '../factories/workItem.factory';

describe('buildWorkItemsListSearchParams', () => {
  it('encodes pagination, search, backlog, hierarchy roots, and labels', () => {
    const params = buildWorkItemsListSearchParams({
      page: 2,
      limit: 10,
      search: '  Ship  ',
      filters: {
        projectId: '33333333-3333-4333-8333-333333333333',
        sprintId: null,
        parentId: null,
        type: 'Task',
        assigneeId: '11111111-1111-4111-8111-111111111111',
        labels: ['Mobile', 'auth'],
      },
    });

    expect(params.get('page')).toBe('2');
    expect(params.get('limit')).toBe('10');
    expect(params.get('search')).toBe('Ship');
    expect(params.get('projectId')).toBe(
      '33333333-3333-4333-8333-333333333333'
    );
    expect(params.get('sprintId')).toBe('null');
    expect(params.get('parentId')).toBe('null');
    expect(params.get('type')).toBe('Task');
    expect(params.get('assigneeId')).toBe(
      '11111111-1111-4111-8111-111111111111'
    );
    expect(params.get('labels')).toBe('["Mobile","auth"]');
  });
});

describe('mapWorkItemApiRow', () => {
  it('normalizes due_date to YYYY-MM-DD and timestamps to ISO strings', () => {
    const mapped = mapWorkItemApiRow({
      ...workItemFactory.build(),
      due_date: '2026-08-17T00:00:00.000Z',
      created_at: new Date('2026-08-01T00:00:00.000Z'),
      updated_at: '2026-08-01T00:00:00.000Z',
    });

    expect(mapped.due_date).toBe('2026-08-17');
    expect(mapped.created_at).toBe('2026-08-01T00:00:00.000Z');
    expect(mapped.updated_at).toBe('2026-08-01T00:00:00.000Z');
  });
});

describe('listWorkItemsPaginatedFromApi / getWorkItemFromApi', () => {
  it('GETs the list path and maps rows', async () => {
    const row = workItemFactory.build({
      due_date: '2026-08-17T00:00:00.000Z',
    });
    const apiFetch = vi.fn().mockResolvedValue({
      workItems: [row],
      totalCount: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    });

    const result = await listWorkItemsPaginatedFromApi(
      apiFetch,
      1,
      10,
      'Ship',
      {
        projectId: row.project_id,
      }
    );

    expect(apiFetch).toHaveBeenCalledWith(
      `/api/workItems?page=1&limit=10&search=Ship&projectId=${row.project_id}`
    );
    expect(result.workItems[0]?.due_date).toBe('2026-08-17');
    expect(result.totalCount).toBe(1);
  });

  it('returns mapped detail and treats 404 as null', async () => {
    const row = workItemFactory.build();
    const apiFetch = vi
      .fn()
      .mockResolvedValueOnce({ data: row, error: null })
      .mockRejectedValueOnce(new ApiError('Work item not found', 404));

    await expect(getWorkItemFromApi(apiFetch, row.id)).resolves.toMatchObject({
      id: row.id,
      title: row.title,
    });
    await expect(getWorkItemFromApi(apiFetch, row.id)).resolves.toBeNull();
  });
});
