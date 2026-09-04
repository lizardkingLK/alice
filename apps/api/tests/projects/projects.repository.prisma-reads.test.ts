import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.GITHUB_ACTIONS = 'true';
});

import type { Database } from '@repo/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { projectListSelect, projectDetailSelect } from '@repo/types';

const { findManyMock, findUniqueMock, countMock, groupByMock } = vi.hoisted(
  () => ({
    findManyMock: vi.fn(),
    findUniqueMock: vi.fn(),
    countMock: vi.fn(),
    groupByMock: vi.fn(),
  })
);

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    projects: {
      findMany: findManyMock,
      findUnique: findUniqueMock,
      count: countMock,
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
});
