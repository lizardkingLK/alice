import { describe, expect, it } from 'vitest';
import { listWorkItemsQuerySchema, paginationMeta } from '@repo/types';
import {
  buildWorkItemPrismaListWhere,
  workItemListPageSlice,
} from '../../src/routes/api/workItems/workItems.prisma-query';

describe('buildWorkItemPrismaListWhere', () => {
  it('defaults record_status to active when there are no filters or search', () => {
    expect(buildWorkItemPrismaListWhere()).toEqual({
      record_status: 'active',
    });
  });

  it('maps equality filters including backlog and hierarchy roots', () => {
    const where = buildWorkItemPrismaListWhere({
      projectId: 'proj-1',
      sprintId: null,
      parentId: null,
      type: 'Task',
      assigneeId: 'user-1',
    });

    expect(where).toEqual({
      project_id: 'proj-1',
      sprint_id: null,
      parent_id: null,
      type: 'Task',
      assignee_id: 'user-1',
      record_status: 'active',
    });
  });

  it('maps projectIds when projectId is absent', () => {
    const where = buildWorkItemPrismaListWhere({
      projectIds: ['proj-1', 'proj-2'],
    });

    expect(where).toEqual({
      project_id: { in: ['proj-1', 'proj-2'] },
      record_status: 'active',
    });
  });

  it('returns an empty project set when projectId is outside projectIds', () => {
    const where = buildWorkItemPrismaListWhere({
      projectId: 'proj-3',
      projectIds: ['proj-1', 'proj-2'],
    });

    expect(where).toEqual({
      project_id: { in: [] },
      record_status: 'active',
    });
  });

  it('honors explicit archived recordStatus', () => {
    const where = buildWorkItemPrismaListWhere({
      recordStatus: 'archived',
    });

    expect(where).toEqual({
      record_status: 'archived',
    });
  });

  it('ORs exact label containment', () => {
    const where = buildWorkItemPrismaListWhere({
      labels: ['Mobile', 'auth'],
    });

    expect(where).toEqual({
      record_status: 'active',
      AND: [
        {
          OR: [
            { labels: { array_contains: ['Mobile'] } },
            { labels: { array_contains: ['auth'] } },
          ],
        },
      ],
    });
  });

  it('searches title ilike (stripped) OR exact label containment', () => {
    const where = buildWorkItemPrismaListWhere(undefined, '  foo,bar(baz)  ');

    expect(where).toEqual({
      record_status: 'active',
      AND: [
        {
          OR: [
            { title: { contains: 'foobarbaz', mode: 'insensitive' } },
            { labels: { array_contains: ['foo,bar(baz)'] } },
          ],
        },
      ],
    });
  });
});

describe('workItemListPageSlice / paginationMeta', () => {
  it('uses zero-based skip for 1-based pages', () => {
    expect(workItemListPageSlice(2, 10)).toEqual({ skip: 10, take: 10 });
  });

  it('keeps at least one total page', () => {
    expect(paginationMeta(0, 1, 10).totalPages).toBe(1);
    expect(paginationMeta(11, 1, 10).totalPages).toBe(2);
  });
});

describe('listWorkItemsQuerySchema', () => {
  it('defaults page and limit and maps hierarchy view to parentId null', () => {
    const parsed = listWorkItemsQuerySchema.safeParse({ view: 'hierarchy' });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.page).toBe(1);
      expect(parsed.data.limit).toBe(10);
      expect(parsed.data.parentId).toBeNull();
      expect(parsed.data.includeDescription).toBe(false);
      expect(parsed.data.recordStatus).toBe('active');
    }
  });

  it('parses sprintId=null as backlog and labels JSON', () => {
    const parsed = listWorkItemsQuerySchema.safeParse({
      sprintId: 'null',
      labels: '["Mobile"]',
      page: '2',
      limit: '5',
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.sprintId).toBeNull();
      expect(parsed.data.labels).toEqual(['Mobile']);
      expect(parsed.data.page).toBe(2);
      expect(parsed.data.limit).toBe(5);
    }
  });

  it('rejects invalid pagination', () => {
    expect(listWorkItemsQuerySchema.safeParse({ page: '0' }).success).toBe(
      false
    );
    expect(listWorkItemsQuerySchema.safeParse({ limit: '101' }).success).toBe(
      false
    );
  });
});
