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
      workflow_config: null,
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
});
