import type { SprintListRow } from '@repo/types';

export function createSprintListRow(
  overrides: Partial<SprintListRow> = {}
): SprintListRow {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    project_id: '33333333-3333-4333-8333-333333333333',
    name: 'Sprint 1',
    goal: 'Complete workitem module v1',
    start_date: new Date('2026-08-01T00:00:00.000Z'),
    end_date: new Date('2026-08-14T00:00:00.000Z'),
    status: 'active',
    summary_report: null,
    created_by: '11111111-1111-4111-8111-111111111111',
    created_at: new Date('2026-08-01T00:00:00.000Z'),
    updated_by: '11111111-1111-4111-8111-111111111111',
    updated_at: new Date('2026-08-01T00:00:00.000Z'),
    project: {
      id: '33333333-3333-4333-8333-333333333333',
      name: 'Alice',
      key: 'ALICE',
    },
    ...overrides,
  };
}
