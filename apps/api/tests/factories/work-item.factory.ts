import type { WorkItemListRow } from '@repo/types';
import { TEST_USER } from './user.fixture';

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
    assignee_id: TEST_USER.id,
    reporter_id: null,
    due_date: null,
    story_points: 3,
    status: 'New',
    done_at: null,
    created_by: TEST_USER.id,
    created_at: new Date('2026-08-01T00:00:00.000Z'),
    updated_by: TEST_USER.id,
    updated_at: new Date('2026-08-01T00:00:00.000Z'),
    jira_issue_key: null,
    record_status: 'active',
    assignee: TEST_USER,
    reporter: null,
    ...overrides,
  };
}
