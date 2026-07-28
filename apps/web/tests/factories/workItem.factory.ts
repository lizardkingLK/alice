import type { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';

const defaultAssignee = {
  id: 'user-123',
  name: 'Erlich Bachman',
  email: 'erlich@bachmanity.com',
};

export const workItemFactory = {
  build(overrides: Partial<DbWorkItem> = {}): DbWorkItem {
    return {
      id: 'wi-1',
      title: 'Implement dashboard filters',
      type: 'Task',
      status: 'ToDo',
      priority: 'medium',
      project_id: 'proj-1',
      assignee_id: defaultAssignee.id,
      reporter_id: null,
      parent_id: null,
      sprint_id: null,
      story_points: null,
      description: null,
      due_date: '2026-07-31',
      created_at: '2026-07-09T10:00:00Z',
      updated_at: '2026-07-09T10:00:00Z',
      created_by: null,
      updated_by: null,
      assignee: defaultAssignee,
      reporter: null,
      ...overrides,
    };
  },

  buildList(count: number, overrides: Partial<DbWorkItem> = {}): DbWorkItem[] {
    return Array.from({ length: count }, (_, index) =>
      workItemFactory.build({
        id: `wi-${index + 1}`,
        title: `Work Item ${index + 1}`,
        ...overrides,
      })
    );
  },
};
