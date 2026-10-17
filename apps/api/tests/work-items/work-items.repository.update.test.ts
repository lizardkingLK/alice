import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.GITHUB_ACTIONS = 'true';
});

import type { Database } from '@repo/types';
import { workItemListSelectWithDescription } from '@repo/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  WorkItemRepository,
  mapPrismaWorkItemMutationRow,
} from '../../src/routes/api/work-items/work-items.repository';
import { createWorkItemListRow } from '../factories/work-item.factory';

const { updateManyMock, findUniqueMock } = vi.hoisted(() => ({
  updateManyMock: vi.fn(),
  findUniqueMock: vi.fn(),
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    work_items: {
      updateMany: updateManyMock,
      findUnique: findUniqueMock,
      create: vi.fn(),
    },
  },
}));

const db = {} as SupabaseClient<Database>;
const repository = new WorkItemRepository(db);

const LOCK = '2026-08-31T06:00:00.123456+00:00';
const ACTOR = 'actor-1';

const current = {
  id: '22222222-2222-4222-8222-222222222222',
  project_id: '33333333-3333-4333-8333-333333333333',
  title: 'Ship Prisma return',
  type: 'Task' as const,
  priority: 'medium' as const,
  assignee_id: null,
  reporter_id: null,
  due_date: null,
  description: null,
  labels: [],
  status: 'New' as const,
  state: null,
  board_column_id: null,
  sprint_id: null,
  story_points: null,
  parent_id: null,
  jira_issue_key: null,
  record_status: 'active' as const,
  created_by: ACTOR,
  created_at: '2026-08-01T00:00:00.000Z',
  updated_by: ACTOR,
  updated_at: LOCK,
  done_at: null,
};

describe('mapPrismaWorkItemMutationRow', () => {
  it('maps Date fields to PostgREST wire strings', () => {
    const row = createWorkItemListRow({
      due_date: new Date('2026-09-15T00:00:00.000Z'),
      done_at: new Date('2026-09-16T12:00:00.000Z'),
    });

    const mapped = mapPrismaWorkItemMutationRow({
      ...row,
      description: null,
    });

    expect(mapped.due_date).toBe('2026-09-15');
    expect(mapped.done_at).toBe('2026-09-16T12:00:00.000Z');
    expect(mapped.created_at).toBe('2026-08-01T00:00:00.000Z');
    expect(mapped.updated_at).toBe('2026-08-01T00:00:00.000Z');
  });
});

describe('WorkItemRepository.update Prisma fetchUpdated', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a Prisma-selected row on the happy path without supabase getById', async () => {
    const prismaRow = createWorkItemListRow({
      title: 'Updated title',
      status: 'InProgress',
      updated_at: new Date('2026-09-01T00:00:00.000Z'),
    });
    updateManyMock.mockResolvedValue({ count: 1 });
    findUniqueMock.mockResolvedValue({ ...prismaRow, description: null });
    const getByIdSpy = vi.spyOn(repository, 'getById');

    const result = await repository.update({
      ...current,
      title: 'Updated title',
      status: 'InProgress',
      board_column_id: null,
      id: current.id,
      updatedBy: ACTOR,
      expectedUpdatedAt: LOCK,
      current: current as never,
    });

    expect(getByIdSpy).not.toHaveBeenCalled();
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { id: current.id },
      select: workItemListSelectWithDescription,
    });
    expect(result.title).toBe('Updated title');
    expect(result.updated_at).toBe('2026-09-01T00:00:00.000Z');
  });

  it('throws OptimisticLockError with the Prisma current row when count is 0', async () => {
    const prismaRow = createWorkItemListRow({ title: 'Server wins' });
    updateManyMock.mockResolvedValue({ count: 0 });
    findUniqueMock.mockResolvedValue({ ...prismaRow, description: null });

    await expect(
      repository.update({
        ...current,
        title: 'Client write',
        status: 'New',
        board_column_id: null,
        id: current.id,
        updatedBy: ACTOR,
        expectedUpdatedAt: LOCK,
        current: current as never,
      })
    ).rejects.toMatchObject({
      name: 'OptimisticLockError',
      serverEntity: expect.objectContaining({ title: 'Server wins' }),
    });

    expect(findUniqueMock).toHaveBeenCalledTimes(1);
  });

  it('uses a millisecond range lock so Prisma matches Postgres timestamps', async () => {
    updateManyMock.mockResolvedValue({ count: 1 });
    findUniqueMock.mockResolvedValue({
      ...createWorkItemListRow(),
      description: null,
    });

    await repository.update({
      ...current,
      status: 'New',
      board_column_id: null,
      id: current.id,
      updatedBy: ACTOR,
      expectedUpdatedAt: LOCK,
      current: current as never,
    });

    const lockMs = new Date(LOCK).getTime();
    expect(updateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: current.id,
          updated_at: {
            gte: new Date(lockMs),
            lt: new Date(lockMs + 1),
          },
        },
      })
    );
  });
});

describe('WorkItemRepository.getMutationRowById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when the row is missing', async () => {
    findUniqueMock.mockResolvedValue(null);

    await expect(repository.getMutationRowById(current.id)).resolves.toBeNull();
  });
});
