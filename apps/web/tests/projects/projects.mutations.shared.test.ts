import { describe, expect, it, vi } from 'vitest';
import { createProjectsService } from '@/app/projects/_services/projects.mutations.shared';
import { projectFactory } from '../factories/project.factory';
import type { CreateProjectInput } from '@/app/projects/_services/projects.mutations.client';

describe('createProjectsService frontend tests', () => {
  it('creates project via POST', async () => {
    const project = projectFactory.build();
    const apiFetch = vi.fn().mockResolvedValue({ project });
    const service = createProjectsService(apiFetch);
    const input: CreateProjectInput = {
      name: 'Project Alpha',
      key: 'PAL',
      description: null,
      owner_id: 'user-1',
      status: 'active' as const,
      start_date: null,
      end_date: null,
      attributes_config: null,
      github_repo: null,
      github_token: null,
    };

    const result = await service.createProject(input);

    expect(apiFetch).toHaveBeenCalledWith('/api/projects', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    expect(result).toEqual(project);
  });

  it('includes initial sprint data in the project POST body', async () => {
    const project = projectFactory.build();
    const apiFetch = vi.fn().mockResolvedValue({ project });
    const service = createProjectsService(apiFetch);
    const input: CreateProjectInput = {
      name: 'Project Alpha',
      key: 'PAL',
      description: null,
      owner_id: 'user-1',
      status: 'active',
      start_date: null,
      end_date: null,
      attributes_config: null,
      sprint: {
        name: 'Sprint 1',
        goal: null,
        startDate: '2026-09-01',
        endDate: '2026-09-14',
      },
    };

    await service.createProject(input);

    expect(apiFetch).toHaveBeenCalledWith('/api/projects', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  });

  it('includes initial team data in the project POST body', async () => {
    const project = projectFactory.build();
    const apiFetch = vi.fn().mockResolvedValue({ project });
    const service = createProjectsService(apiFetch);
    const input: CreateProjectInput = {
      name: 'Project Alpha',
      key: 'PAL',
      description: null,
      owner_id: '11111111-1111-4111-8111-111111111111',
      status: 'active',
      start_date: null,
      end_date: null,
      attributes_config: null,
      team: {
        name: 'Platform Team',
        description: null,
        manager_id: '22222222-2222-4222-8222-222222222222',
        tech_stack: null,
        status: 'active',
        member_ids: ['33333333-3333-4333-8333-333333333333'],
      },
    };

    await service.createProject(input);

    expect(apiFetch).toHaveBeenCalledWith('/api/projects', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  });

  it('updates project via PUT', async () => {
    const project = projectFactory.build({ name: 'Updated name' });
    const apiFetch = vi.fn().mockResolvedValue({ project });
    const service = createProjectsService(apiFetch);
    const input = { name: 'Updated name' };

    const result = await service.updateProject(
      'proj-1',
      input,
      '2026-07-09T10:00:00Z'
    );

    expect(apiFetch).toHaveBeenCalledWith('/api/projects/proj-1', {
      method: 'PUT',
      body: JSON.stringify({
        ...input,
        expectedUpdatedAt: '2026-07-09T10:00:00Z',
      }),
    });
    expect(result).toEqual(project);
  });

  it('updates project work item types via PUT workflow_config', async () => {
    const project = projectFactory.build();
    const apiFetch = vi.fn().mockResolvedValue({ project });
    const service = createProjectsService(apiFetch);
    const workflow_config = {
      work_item_types: ['Epic', 'Story', 'Task'] as Array<
        'Epic' | 'Story' | 'Task' | 'Issue' | 'Feature'
      >,
    };

    await service.updateProject('proj-1', { workflow_config }, 'timestamp');

    expect(apiFetch).toHaveBeenCalledWith('/api/projects/proj-1', {
      method: 'PUT',
      body: JSON.stringify({ workflow_config, expectedUpdatedAt: 'timestamp' }),
    });
  });

  it('soft deletes project via PATCH', async () => {
    const project = projectFactory.build({
      status: 'archived',
      deleted_at: '2026-08-11T00:00:00.000Z',
    });
    const apiFetch = vi.fn().mockResolvedValue({ project });
    const service = createProjectsService(apiFetch);

    const result = await service.softDeleteProject(
      'proj-1',
      '2026-07-09T10:00:00Z'
    );

    expect(apiFetch).toHaveBeenCalledWith('/api/projects/proj-1/soft-delete', {
      method: 'PATCH',
      body: JSON.stringify({
        expectedUpdatedAt: '2026-07-09T10:00:00Z',
      }),
    });
    expect(result).toEqual(project);
  });

  it('restores project via PATCH', async () => {
    const project = projectFactory.build({
      status: 'active',
      deleted_at: null,
    });
    const apiFetch = vi.fn().mockResolvedValue({ project });
    const service = createProjectsService(apiFetch);

    const result = await service.restoreProject(
      'proj-1',
      '2026-07-09T10:00:00Z'
    );

    expect(apiFetch).toHaveBeenCalledWith('/api/projects/proj-1/restore', {
      method: 'PATCH',
      body: JSON.stringify({
        expectedUpdatedAt: '2026-07-09T10:00:00Z',
      }),
    });
    expect(result).toEqual(project);
  });

  it('hard deletes project via DELETE', async () => {
    const apiFetch = vi.fn().mockResolvedValue(undefined);
    const service = createProjectsService(apiFetch);

    await service.hardDeleteProject('proj-1');

    expect(apiFetch).toHaveBeenCalledWith('/api/projects/proj-1', {
      method: 'DELETE',
    });
  });

  it('adds project member via POST', async () => {
    const apiFetch = vi.fn().mockResolvedValue(undefined);
    const service = createProjectsService(apiFetch);

    await service.addProjectMember('proj-1', 'user-2');

    expect(apiFetch).toHaveBeenCalledWith('/api/projects/proj-1/members', {
      method: 'POST',
      body: JSON.stringify({ userId: 'user-2' }),
    });
  });

  it('removes project member via DELETE', async () => {
    const apiFetch = vi.fn().mockResolvedValue(undefined);
    const service = createProjectsService(apiFetch);

    await service.removeProjectMember('proj-1', 'user-2');

    expect(apiFetch).toHaveBeenCalledWith(
      '/api/projects/proj-1/members/user-2',
      {
        method: 'DELETE',
      }
    );
  });

  it('updates project dynamic fields config via PUT', async () => {
    const project = projectFactory.build();
    const apiFetch = vi.fn().mockResolvedValue({ project });
    const service = createProjectsService(apiFetch);
    const config = { type: 'object', properties: {} };

    const result = await service.updateProjectFieldsConfig('proj-1', config);

    expect(apiFetch).toHaveBeenCalledWith('/api/projects/proj-1', {
      method: 'PUT',
      body: JSON.stringify({ attributes_config: config }),
    });
    expect(result).toEqual(project);
  });

  it('updates project dynamic fields config with expectedUpdatedAt via PUT', async () => {
    const project = projectFactory.build({
      updated_at: '2026-09-10T08:00:00.000Z',
    });
    const apiFetch = vi.fn().mockResolvedValue({ project });
    const service = createProjectsService(apiFetch);
    const config = { type: 'object', properties: {} };
    const expectedUpdatedAt = '2026-09-10T08:00:00.000Z';

    const result = await service.updateProjectFieldsConfig(
      'proj-1',
      config,
      expectedUpdatedAt
    );

    expect(apiFetch).toHaveBeenCalledWith('/api/projects/proj-1', {
      method: 'PUT',
      body: JSON.stringify({
        attributes_config: config,
        expectedUpdatedAt,
      }),
    });
    expect(result).toEqual(project);
  });
});
