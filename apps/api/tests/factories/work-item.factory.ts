import type { WorkItemListRow } from '@repo/types';

const USER = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Ada',
  email: 'ada@example.com',
  profile_picture: null,
};

export function createWorkItemListRow(
  overrides: Partial<WorkItemListRow> = {}
): WorkItemListRow {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    project_id: '33333333-3333-4333-8333-333333333333',
    sprint_id: null,
    parent_id: null,
    title: 'Ship Prisma reads',
    type: 'Task',
    priority: 'medium',
    labels: ['api'],
    assignee_id: USER.id,
    reporter_id: null,
    due_date: null,
    story_points: 3,
    status: 'New',
    done_at: null,
    created_by: USER.id,
    created_at: new Date('2026-08-01T00:00:00.000Z'),
    updated_by: USER.id,
    updated_at: new Date('2026-08-01T00:00:00.000Z'),
    jira_issue_key: null,
    assignee: USER,
    reporter: null,
    ...overrides,
  };
}
