import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  selectSingleMock,
  findByIdMock,
  findByKeyMock,
  listMembersMock,
  addMemberMock,
  removeMemberMock,
  createMock,
  updateMock,
  deleteMock,
  getJiraSettingsMock,
  saveJiraSettingsMock,
} = vi.hoisted(() => ({
  selectSingleMock: vi.fn(),
  findByIdMock: vi.fn(),
  findByKeyMock: vi.fn(),
  listMembersMock: vi.fn(),
  addMemberMock: vi.fn(),
  removeMemberMock: vi.fn(),
  createMock: vi.fn(),
  updateMock: vi.fn(),
  deleteMock: vi.fn(),
  getJiraSettingsMock: vi.fn(),
  saveJiraSettingsMock: vi.fn(),
}));

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
  CreateProjectInput,
  ProjectsService,
} from '../../src/routes/api/projects/projects.service';
import type { ProjectsRepository } from '../../src/routes/api/projects/projects.repository';

const mockProject = {
  id: 'project-1',
  name: 'Alice Project',
  key: 'ALICE',
  description: 'A project description',
  status: 'active' as const,
  start_date: '2026-01-01',
  end_date: '2026-12-31',
  owner_id: 'user-manager',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
  jira_url: null,
  jira_email: null,
  jira_token: null,
  jira_project_key: null,
  github_repo: null,
  github_token: null,
  logo_url: null,
  cover_picture: null,
};

describe('ProjectsService backend tests', () => {
  const projectsRepository = {
    findById: findByIdMock,
    findByKey: findByKeyMock,
    listMembers: listMembersMock,
    addMember: addMemberMock,
    removeMember: removeMemberMock,
    create: createMock,
    update: updateMock,
    delete: deleteMock,
    getJiraSettings: getJiraSettingsMock,
    saveJiraSettings: saveJiraSettingsMock,
  } as unknown as ProjectsRepository;

  const service = new ProjectsService(projectsRepository);

  const createProjectInput = (
    overrides: Partial<CreateProjectInput> = {}
  ): CreateProjectInput => ({
    name: 'Alice Project',
    key: 'ALICE',
    description: 'A project description',
    status: 'active',
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    owner_id: 'user-manager',
    jira_url: null,
    jira_email: null,
    jira_token: null,
    jira_project_key: null,
    github_repo: null,
    github_token: null,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockActorRole(role: 'admin' | 'manager' | 'member' | null) {
    if (!role) {
      selectSingleMock.mockResolvedValue({
        data: null,
        error: new Error('User not found'),
      });
    } else {
      selectSingleMock.mockResolvedValue({ data: { role }, error: null });
    }
  }

  describe('createProject', () => {
    it('creates project successfully as administrator', async () => {
      mockActorRole('admin');
      findByKeyMock.mockResolvedValue(null);
      createMock.mockResolvedValue(mockProject);

      const input = createProjectInput();

      const result = await service.createProject('user-admin', input);

      expect(findByKeyMock).toHaveBeenCalledWith('ALICE');
      expect(createMock).toHaveBeenCalledWith(input, 'user-admin');
      expect(result).toEqual(mockProject);
    });

    it('rejects creation for managers', async () => {
      mockActorRole('manager');

      const input = createProjectInput();

      await expect(
        service.createProject('user-manager', input)
      ).rejects.toThrow(
        'Unauthorized. Only administrators can create or permanently delete projects.'
      );

      expect(createMock).not.toHaveBeenCalled();
    });

    it('rejects creation for standard members', async () => {
      mockActorRole('member');

      const input = createProjectInput();

      await expect(service.createProject('user-member', input)).rejects.toThrow(
        'Unauthorized. Only administrators can create or permanently delete projects.'
      );

      expect(createMock).not.toHaveBeenCalled();
    });

    it('validates key uniqueness on creation', async () => {
      mockActorRole('admin');
      findByKeyMock.mockResolvedValue(mockProject); // Duplicate exists

      const input = createProjectInput();

      await expect(service.createProject('user-admin', input)).rejects.toThrow(
        'A project with the key "ALICE" already exists.'
      );

      expect(createMock).not.toHaveBeenCalled();
    });
  });

  describe('updateProject', () => {
    it('updates project successfully as manager/admin', async () => {
      mockActorRole('manager');
      findByKeyMock.mockResolvedValue(null);
      updateMock.mockResolvedValue({ ...mockProject, name: 'Updated name' });

      const input = { name: 'Updated name', key: 'ALICE' };

      const result = await service.updateProject(
        'user-manager',
        'project-1',
        input,
        mockProject.updated_at
      );

      expect(findByKeyMock).toHaveBeenCalledWith('ALICE', 'project-1');
      expect(updateMock).toHaveBeenCalledWith(
        'project-1',
        input,
        'user-manager',
        mockProject.updated_at
      );
      expect(result.name).toBe('Updated name');
    });

    it('validates key uniqueness on update', async () => {
      mockActorRole('manager');
      // Duplicate key found belonging to another project
      findByKeyMock.mockResolvedValue({ id: 'project-2', key: 'ALICE' });

      const input = { key: 'ALICE' };

      await expect(
        service.updateProject(
          'user-manager',
          'project-1',
          input,
          mockProject.updated_at
        )
      ).rejects.toThrow('Another project with the key "ALICE" already exists.');

      expect(updateMock).not.toHaveBeenCalled();
    });

    it('rejects updates for standard members', async () => {
      mockActorRole('member');

      await expect(
        service.updateProject(
          'user-member',
          'project-1',
          { name: 'Updated' },
          mockProject.updated_at
        )
      ).rejects.toThrow(
        'Unauthorized. Only admins and managers can manage projects.'
      );

      expect(updateMock).not.toHaveBeenCalled();
    });
  });

  describe('softDeleteProject', () => {
    it('sets deleted_at and archives project', async () => {
      mockActorRole('manager');
      updateMock.mockResolvedValue({
        ...mockProject,
        status: 'archived',
        deleted_at: '2026-08-11T00:00:00.000Z',
      });

      const result = await service.softDeleteProject(
        'user-manager',
        'project-1',
        mockProject.updated_at
      );

      expect(updateMock).toHaveBeenCalledWith(
        'project-1',
        expect.objectContaining({
          status: 'archived',
          deleted_at: expect.any(String),
        }),
        'user-manager',
        mockProject.updated_at
      );
      expect(result.status).toBe('archived');
      expect(result.deleted_at).not.toBeNull();
    });

    it('rejects soft delete for standard members', async () => {
      mockActorRole('member');

      await expect(
        service.softDeleteProject(
          'user-member',
          'project-1',
          mockProject.updated_at
        )
      ).rejects.toThrow(
        'Unauthorized. Only admins and managers can manage projects.'
      );

      expect(updateMock).not.toHaveBeenCalled();
    });
  });

  describe('restoreProject', () => {
    it('clears deleted_at and sets project to active', async () => {
      mockActorRole('manager');
      updateMock.mockResolvedValue({
        ...mockProject,
        status: 'active',
        deleted_at: null,
      });

      const result = await service.restoreProject(
        'user-manager',
        'project-1',
        mockProject.updated_at
      );

      expect(updateMock).toHaveBeenCalledWith(
        'project-1',
        {
          deleted_at: null,
          status: 'active',
        },
        'user-manager',
        mockProject.updated_at
      );
      expect(result.status).toBe('active');
      expect(result.deleted_at).toBeNull();
    });

    it('rejects restore for standard members', async () => {
      mockActorRole('member');

      await expect(
        service.restoreProject(
          'user-member',
          'project-1',
          mockProject.updated_at
        )
      ).rejects.toThrow(
        'Unauthorized. Only admins and managers can manage projects.'
      );

      expect(updateMock).not.toHaveBeenCalled();
    });
  });

  describe('hardDeleteProject', () => {
    it('deletes project permanently when administrator', async () => {
      mockActorRole('admin');
      deleteMock.mockResolvedValue(undefined);

      await service.hardDeleteProject('user-admin', 'project-1');

      expect(deleteMock).toHaveBeenCalledWith('project-1');
    });

    it('rejects hard delete when actor is only a manager', async () => {
      mockActorRole('manager');

      await expect(
        service.hardDeleteProject('user-manager', 'project-1')
      ).rejects.toThrow(
        'Unauthorized. Only administrators can create or permanently delete projects.'
      );

      expect(deleteMock).not.toHaveBeenCalled();
    });
  });
});
