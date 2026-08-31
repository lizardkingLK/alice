import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '@repo/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { teamListSelect } from '@repo/types';

const { findManyMock, findUniqueMock, countMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  findUniqueMock: vi.fn(),
  countMock: vi.fn(),
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    teams: {
      findMany: findManyMock,
      findUnique: findUniqueMock,
      count: countMock,
    },
  },
}));

import { TeamsRepository } from '../../src/routes/api/teams/teams.repository';

const db = {} as SupabaseClient<Database>;
const repository = new TeamsRepository(db);

const mockTeamRow = {
  id: 'team-1',
  name: 'Backend Devs',
  description: 'Team description',
  manager_id: 'manager-1',
  project_id: 'project-1',
  tech_stack: 'Node.js, Postgres',
  status: 'active',
  created_at: new Date('2026-08-25T12:00:00.000Z'),
  updated_at: new Date('2026-08-25T12:00:00.000Z'),
  manager: { id: 'manager-1', name: 'Manager', email: 'manager@example.com' },
  members: [
    {
      team_id: 'team-1',
      user_id: 'user-1',
      role: 'developer',
      seniority: 'senior',
      capacity: 40,
      allocation: 100,
      reporting_line: null,
      status: 'active',
    },
  ],
};

describe('TeamsRepository Prisma reads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists with status, projectId, search, and page slice', async () => {
    findManyMock.mockResolvedValue([mockTeamRow]);
    countMock.mockResolvedValue(1);

    const result = await repository.listPaginated({
      projectId: 'project-1',
      status: 'active',
      search: 'Backend',
      page: 1,
      limit: 10,
    });

    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        project_id: 'project-1',
        status: 'active',
        OR: [
          { name: { contains: 'Backend', mode: 'insensitive' } },
          { description: { contains: 'Backend', mode: 'insensitive' } },
          { tech_stack: { contains: 'Backend', mode: 'insensitive' } },
        ],
      },
      select: teamListSelect,
      orderBy: { created_at: 'desc' },
      skip: 0,
      take: 10,
    });

    expect(result).toEqual({
      teams: [mockTeamRow],
      totalCount: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    });
  });

  it('loads detail by id with teamListSelect', async () => {
    findUniqueMock.mockResolvedValue(mockTeamRow);

    const result = await repository.getDetailById('team-1');

    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { id: 'team-1' },
      select: teamListSelect,
    });
    expect(result).toEqual(mockTeamRow);
  });
});
