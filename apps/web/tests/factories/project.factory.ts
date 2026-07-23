import type { Project } from '@/app/projects/_services/projects.service';

export const projectFactory = {
  build(overrides: Partial<Project> = {}): Project {
    return {
      id: 'proj-1',
      name: 'Project Alpha',
      key: 'PAL',
      description: null,
      owner_id: 'user-1',
      status: 'active',
      start_date: null,
      end_date: null,
      created_at: '2026-07-09T10:00:00Z',
      updated_at: '2026-07-09T10:00:00Z',
      created_by: null,
      updated_by: null,
      deleted_at: null,
      attributes_config: null,
      workflow_config: null,
      ...overrides,
    };
  },

  buildList(count: number, overrides: Partial<Project> = {}): Project[] {
    return Array.from({ length: count }, (_, index) =>
      projectFactory.build({
        id: `proj-${index + 1}`,
        name: `Project ${index + 1}`,
        key: `P${String(index + 1).padStart(2, '0')}`,
        ...overrides,
      })
    );
  },
};
