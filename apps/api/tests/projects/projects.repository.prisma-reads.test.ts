import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.GITHUB_ACTIONS = 'true';
});

import type { Database } from '@repo/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { projectListSelect, projectDetailSelect } from '@repo/types';
import { Prisma } from '@repo/types/prisma';

const { findManyMock, findUniqueMock, countMock, groupByMock, updateManyMock } =
  vi.hoisted(() => ({
    findManyMock: vi.fn(),
    findUniqueMock: vi.fn(),
    countMock: vi.fn(),
    groupByMock: vi.fn(),
    updateManyMock: vi.fn(),
  }));

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    projects: {
      findMany: findManyMock,
      findUnique: findUniqueMock,
      count: countMock,
      updateMany: updateManyMock,
    },
    teams: {
      groupBy: groupByMock,
    },
  },
}));

import { ProjectsRepository } from '../../src/routes/api/projects/projects.repository';

const db = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi
          .fn()
          .mockResolvedValue({ data: { role: 'admin' }, error: null }),
      })),
    })),
  })),
} as unknown as SupabaseClient<Database>;

const repository = new ProjectsRepository(db);

const mockProjectRow = {
  id: 'project-1',
  name: 'Alice Project',
  key: 'ALICE',
  description: 'A description',
  status: 'active',
  owner_id: 'owner-1',
  start_date: new Date('2026-08-25T12:00:00.000Z'),
  end_date: new Date('2026-08-30T12:00:00.000Z'),
  created_at: new Date('2026-08-25T12:00:00.000Z'),
  updated_at: new Date('2026-08-25T12:00:00.000Z'),
  deleted_at: null,
  logo_url: null,
  cover_picture: null,
  owner: { id: 'owner-1', name: 'Owner', email: 'owner@example.com' },
};

describe('ProjectsRepository Prisma reads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists with status filter, search, page slice, and includes team_count', async () => {
    findManyMock.mockResolvedValue([mockProjectRow]);
    countMock.mockResolvedValue(1);
    groupByMock.mockResolvedValue([
      { project_id: 'project-1', _count: { id: 3 } },
    ]);

    const result = await repository.listPaginated({
      accessibleIds: ['project-1'],
      filters: { status: 'active', search: 'Alice' },
      page: 1,
      limit: 10,
    });

    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        id: { in: ['project-1'] },
        deleted_at: null,
        OR: [
          { name: { contains: 'Alice', mode: 'insensitive' } },
          { key: { contains: 'Alice', mode: 'insensitive' } },
          { description: { contains: 'Alice', mode: 'insensitive' } },
        ],
      },
      select: projectListSelect,
      orderBy: { created_at: 'desc' },
      skip: 0,
      take: 10,
    });

    expect(result).toEqual({
      projects: [{ ...mockProjectRow, team_count: 3 }],
      totalCount: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    });
  });

  it('loads detail by id with projectDetailSelect', async () => {
    findUniqueMock.mockResolvedValue(mockProjectRow);

    const result = await repository.getDetailById('project-1');

    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      select: projectDetailSelect,
    });
    expect(result).toEqual(mockProjectRow);
  });

  it('persists workflow config through the optimistic project update', async () => {
    updateManyMock.mockResolvedValue({ count: 1 });
    const workflow_config = {
      version: '1' as const,
      columns: [
        { id: 'new', name: 'New', status: 'New' as const },
        { id: 'todo', name: 'Ready', status: 'ToDo' as const },
        { id: 'doing', name: 'Doing', status: 'InProgress' as const },
        { id: 'testing', name: 'Testing', status: 'Testing' as const },
        { id: 'done', name: 'Done', status: 'Done' as const },
      ],
    };

    await repository.update(
      'project-1',
      { workflow_config },
      'actor-1',
      '2026-08-25T12:00:00.000Z'
    );

    expect(updateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'project-1',
          updated_at: new Date('2026-08-25T12:00:00.000Z'),
        },
        data: expect.objectContaining({ workflow_config }),
      })
    );
  });

  it('preserves workflow config when the field is omitted', async () => {
    updateManyMock.mockResolvedValue({ count: 1 });

    await repository.update(
      'project-1',
      { name: 'Renamed project' },
      'actor-1',
      '2026-08-25T12:00:00.000Z'
    );

    const data = updateManyMock.mock.calls[0]?.[0].data;
    expect(data).not.toHaveProperty('workflow_config');
  });

  it('keeps optimistic-lock conflict behavior for workflow config saves', async () => {
    updateManyMock.mockResolvedValue({ count: 0 });

    await expect(
      repository.update(
        'project-1',
        { workflow_config: null },
        'actor-1',
        '2026-08-25T12:00:00.000Z'
      )
    ).rejects.toMatchObject({ name: 'OptimisticLockError' });
  });

  it('uses the Prisma database-null sentinel when resetting the board', async () => {
    updateManyMock.mockResolvedValue({ count: 1 });

    await repository.update(
      'project-1',
      { workflow_config: null },
      'actor-1',
      '2026-08-25T12:00:00.000Z'
    );

    expect(updateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ workflow_config: Prisma.DbNull }),
      })
    );
  });
});
