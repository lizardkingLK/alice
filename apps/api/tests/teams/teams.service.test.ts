import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  selectSingleMock,
  findByIdMock,
  findByNameMock,
  createMock,
  updateMock,
} = vi.hoisted(() => {
  process.env.GITHUB_ACTIONS = 'true';
  return {
    selectSingleMock: vi.fn(),
    findByIdMock: vi.fn(),
    findByNameMock: vi.fn(),
    createMock: vi.fn(),
    updateMock: vi.fn(),
  };
});

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: selectSingleMock,
        })),
      })),
    })),
  },
}));

import {
  TeamsService,
  type CreateTeamInput,
} from '../../src/routes/api/teams/teams.service';
import type { TeamsRepository } from '../../src/routes/api/teams/teams.repository';

const mockTeam = {
  id: 'team-1',
  name: 'IGBC',
  description: 'Team description',
  manager_id: 'manager-1',
  project_id: 'project-sg',
  tech_stack: 'Next.js',
  status: 'active' as const,
  created_at: '2026-08-25T12:00:00.000Z',
  updated_at: '2026-08-25T12:00:00.000Z',
  created_by: 'user-manager',
  updated_by: 'user-manager',
};

describe('TeamsService project-scoped uniqueness validation', () => {
  let teamsService: TeamsService;
  let mockRepository: TeamsRepository;

  beforeEach(() => {
    vi.clearAllMocks();

    selectSingleMock.mockResolvedValue({
      data: { role: 'manager', email: 'manager@example.com' },
      error: null,
    });

    mockRepository = {
      findById: findByIdMock,
      findByName: findByNameMock,
      create: createMock,
      update: updateMock,
    } as unknown as TeamsRepository;

    teamsService = new TeamsService(mockRepository);
  });

  describe('createTeam', () => {
    it('creates team when name is unique within the project', async () => {
      findByNameMock.mockResolvedValue(null);
      createMock.mockResolvedValue(mockTeam);

      const input: CreateTeamInput = {
        name: 'IGBC',
        description: 'Dynamic 365 BC',
        manager_id: 'manager-1',
        project_id: 'project-sg',
        tech_stack: 'Next.js',
        status: 'active',
      };

      const result = await teamsService.createTeam('user-manager', input);

      expect(findByNameMock).toHaveBeenCalledWith('IGBC', 'project-sg');
      expect(createMock).toHaveBeenCalledWith(input, 'user-manager');
      expect(result).toEqual(mockTeam);
    });

    it('rejects team creation when a team with the same name already exists in the same project', async () => {
      findByNameMock.mockResolvedValue(mockTeam);

      const input: CreateTeamInput = {
        name: 'IGBC',
        description: 'Dynamic 365 BC duplicate',
        manager_id: 'manager-1',
        project_id: 'project-sg',
        tech_stack: 'Next.js',
        status: 'active',
      };

      await expect(
        teamsService.createTeam('user-manager', input)
      ).rejects.toThrow('A team with the name "IGBC" already exists.');

      expect(findByNameMock).toHaveBeenCalledWith('IGBC', 'project-sg');
      expect(createMock).not.toHaveBeenCalled();
    });

    it('allows same team name in a different project', async () => {
      findByNameMock.mockImplementation((name, projectId) => {
        if (name === 'IGBC' && projectId === 'project-alice') {
          return Promise.resolve({ ...mockTeam, project_id: 'project-alice' });
        }
        return Promise.resolve(null);
      });
      createMock.mockResolvedValue(mockTeam);

      const input: CreateTeamInput = {
        name: 'IGBC',
        description: 'SG Team',
        manager_id: 'manager-1',
        project_id: 'project-sg',
        tech_stack: 'Next.js',
        status: 'active',
      };

      const result = await teamsService.createTeam('user-manager', input);

      expect(findByNameMock).toHaveBeenCalledWith('IGBC', 'project-sg');
      expect(createMock).toHaveBeenCalledWith(input, 'user-manager');
      expect(result).toEqual(mockTeam);
    });

    it('handles team creation with null project_id', async () => {
      findByNameMock.mockResolvedValue(null);
      createMock.mockResolvedValue({ ...mockTeam, project_id: null });

      const input: CreateTeamInput = {
        name: 'General Team',
        description: 'No project',
        manager_id: 'manager-1',
        project_id: null,
        tech_stack: 'Node',
        status: 'active',
      };

      const result = await teamsService.createTeam('user-manager', input);

      expect(findByNameMock).toHaveBeenCalledWith('General Team', null);
      expect(createMock).toHaveBeenCalledWith(input, 'user-manager');
      expect(result.project_id).toBeNull();
    });
  });

  describe('updateTeam', () => {
    it('updates team when name does not conflict within the project', async () => {
      findByNameMock.mockResolvedValue(null);
      updateMock.mockResolvedValue({ ...mockTeam, name: 'IGBC Renamed' });

      const result = await teamsService.updateTeam(
        'user-manager',
        'team-1',
        { name: 'IGBC Renamed', project_id: 'project-sg' },
        '2026-08-25T12:00:00.000Z'
      );

      expect(findByNameMock).toHaveBeenCalledWith(
        'IGBC Renamed',
        'project-sg',
        'team-1'
      );
      expect(updateMock).toHaveBeenCalled();
      expect(result.name).toBe('IGBC Renamed');
    });

    it('infers existing project_id when only name is updated', async () => {
      findByIdMock.mockResolvedValue(mockTeam);
      findByNameMock.mockResolvedValue(null);
      updateMock.mockResolvedValue({ ...mockTeam, name: 'IGBC New' });

      await teamsService.updateTeam(
        'user-manager',
        'team-1',
        { name: 'IGBC New' },
        '2026-08-25T12:00:00.000Z'
      );

      expect(findByIdMock).toHaveBeenCalledWith('team-1');
      expect(findByNameMock).toHaveBeenCalledWith(
        'IGBC New',
        'project-sg',
        'team-1'
      );
    });

    it('rejects update when another team in the project has the same name', async () => {
      findByNameMock.mockResolvedValue({ ...mockTeam, id: 'team-2' });

      await expect(
        teamsService.updateTeam(
          'user-manager',
          'team-1',
          { name: 'Existing Team', project_id: 'project-sg' },
          '2026-08-25T12:00:00.000Z'
        )
      ).rejects.toThrow(
        'Another team with the name "Existing Team" already exists.'
      );

      expect(updateMock).not.toHaveBeenCalled();
    });
  });
});
