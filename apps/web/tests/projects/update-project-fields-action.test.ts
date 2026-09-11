import { describe, expect, it, vi } from 'vitest';
import { updateProjectFieldsConfig } from '@/app/projects/_services/projects.mutations.client';
import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';

vi.mock('@/lib/api/api-fetch.mutations.use.client', () => ({
  apiFetch: vi.fn(),
}));

describe('updateProjectFieldsConfig client mutation', () => {
  it('sends PUT request with attributes_config', async () => {
    const mockUpdatedProject = {
      id: 'proj-1',
      name: 'Test Project',
      attributes_config: {
        type: 'object',
        properties: {
          priority: { type: 'string' },
        },
      },
    };

    vi.mocked(apiFetch).mockResolvedValue({ project: mockUpdatedProject });

    const config = {
      type: 'object',
      properties: {
        priority: { type: 'string' },
      },
    };

    const result = await updateProjectFieldsConfig('proj-1', config);

    expect(apiFetch).toHaveBeenCalledWith('/api/projects/proj-1', {
      method: 'PUT',
      body: JSON.stringify({ attributes_config: config }),
    });
    expect(result).toEqual(mockUpdatedProject);
  });

  it('sends PUT request with attributes_config and expectedUpdatedAt', async () => {
    const mockUpdatedProject = {
      id: 'proj-1',
      name: 'Test Project',
      updated_at: '2026-09-10T08:00:00.000Z',
    };

    vi.mocked(apiFetch).mockResolvedValue({ project: mockUpdatedProject });

    const config = { type: 'object', properties: {} };
    const expectedUpdatedAt = '2026-09-10T08:00:00.000Z';

    const result = await updateProjectFieldsConfig(
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
    expect(result).toEqual(mockUpdatedProject);
  });
});
