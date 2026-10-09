import { describe, expect, it } from 'vitest';
import { WorkItemStatusEnum } from '@repo/types';
import type { WorkItemUpdateBody } from '../../src/routes/api/work-items/work-items.schemas';
import type { DbWorkItem } from '../../src/routes/api/work-items/work-items.repository';
import {
  collectWorkItemFieldChanges,
  resolveBoardColumnPatchValue,
} from '../../src/routes/api/work-items/work-items.patch-utils';

const currentWorkItem = {
  id: 'wi-1',
  project_id: 'project-1',
  title: 'Old title',
  type: 'Task',
  priority: 'medium',
  assignee_id: null,
  reporter_id: null,
  due_date: null,
  status: WorkItemStatusEnum.New,
  board_column_id: WorkItemStatusEnum.New,
  sprint_id: null,
  story_points: null,
  parent_id: null,
  description: null,
  labels: [],
  jira_issue_key: null,
  state: null,
} as unknown as DbWorkItem;

function updateBody(
  overrides: Partial<WorkItemUpdateBody> = {}
): WorkItemUpdateBody {
  return {
    title: currentWorkItem.title,
    project_id: currentWorkItem.project_id,
    type: 'Task',
    priority: 'medium',
    assignee_id: null,
    reporter_id: null,
    due_date: null,
    status: WorkItemStatusEnum.New,
    board_column_id: WorkItemStatusEnum.New,
    sprint_id: null,
    story_points: null,
    parent_id: null,
    description: null,
    labels: [],
    ...overrides,
  };
}

describe('collectWorkItemFieldChanges', () => {
  it('includes status by default and opaque description updates', () => {
    const changes = collectWorkItemFieldChanges(
      currentWorkItem,
      updateBody({
        title: 'New title',
        status: WorkItemStatusEnum.ToDo,
        board_column_id: WorkItemStatusEnum.ToDo,
        description: { type: 'doc', content: [] },
      })
    );

    expect(changes).toEqual(
      expect.arrayContaining([
        { field: 'title', oldValue: 'Old title', newValue: 'New title' },
        {
          field: 'status',
          oldValue: WorkItemStatusEnum.New,
          newValue: WorkItemStatusEnum.ToDo,
        },
        {
          field: 'description',
          oldValue: null,
          newValue: 'updated',
        },
      ])
    );
  });

  it('omits status when includeStatus is false', () => {
    const changes = collectWorkItemFieldChanges(
      currentWorkItem,
      updateBody({
        status: WorkItemStatusEnum.ToDo,
        board_column_id: WorkItemStatusEnum.ToDo,
      }),
      { includeStatus: false }
    );

    expect(changes.find((change) => change.field === 'status')).toBeUndefined();
  });
});

describe('resolveBoardColumnPatchValue', () => {
  it('preserves placement for unrelated omitted patches', () => {
    expect(
      resolveBoardColumnPatchValue({
        wasProvided: false,
        value: undefined,
        currentValue: 'code-review',
        workflowContextChanged: false,
      })
    ).toBe('code-review');
  });

  it('clears omitted placement when status or project changes', () => {
    expect(
      resolveBoardColumnPatchValue({
        wasProvided: false,
        value: undefined,
        currentValue: 'code-review',
        workflowContextChanged: true,
      })
    ).toBeNull();
  });

  it('distinguishes explicit null from a provided column ID', () => {
    const base = {
      wasProvided: true,
      currentValue: 'development',
      workflowContextChanged: false,
    } as const;

    expect(resolveBoardColumnPatchValue({ ...base, value: null })).toBeNull();
    expect(
      resolveBoardColumnPatchValue({ ...base, value: 'code-review' })
    ).toBe('code-review');
  });
});
