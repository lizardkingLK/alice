import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WORKFLOW_ID,
  WorkItemStatusEnum,
  buildWorkItemStateFromLegacy,
  categoryFromWorkItemStatus,
  doneAtForCategoryChange,
  legacyStatusFromWorkItemState,
  parseWorkItemState,
  resolveWorkItemState,
  syncWorkItemStateForStatusChange,
  workItemStateSchema,
} from '@repo/types';

describe('categoryFromWorkItemStatus', () => {
  it('maps each legacy status to a category', () => {
    expect(categoryFromWorkItemStatus(WorkItemStatusEnum.Draft)).toBe('draft');
    expect(categoryFromWorkItemStatus(WorkItemStatusEnum.New)).toBe('todo');
    expect(categoryFromWorkItemStatus(WorkItemStatusEnum.ToDo)).toBe('todo');
    expect(categoryFromWorkItemStatus(WorkItemStatusEnum.InProgress)).toBe(
      'in_progress'
    );
    expect(categoryFromWorkItemStatus(WorkItemStatusEnum.Testing)).toBe(
      'in_progress'
    );
    expect(categoryFromWorkItemStatus(WorkItemStatusEnum.Done)).toBe('done');
  });
});

describe('buildWorkItemStateFromLegacy', () => {
  it('uses status as stateId and seeded workflow by default', () => {
    expect(
      buildWorkItemStateFromLegacy({ status: WorkItemStatusEnum.Testing })
    ).toEqual({
      workflowId: DEFAULT_WORKFLOW_ID,
      stateId: WorkItemStatusEnum.Testing,
      category: 'in_progress',
    });
  });

  it('prefers boardColumnId over status for stateId', () => {
    expect(
      buildWorkItemStateFromLegacy({
        status: WorkItemStatusEnum.InProgress,
        boardColumnId: 'code-review',
      }).stateId
    ).toBe('code-review');
  });
});

describe('parseWorkItemState / resolveWorkItemState', () => {
  it('returns null for invalid JSON shapes', () => {
    expect(parseWorkItemState(null)).toBeNull();
    expect(parseWorkItemState({ workflowId: 'x' })).toBeNull();
  });

  it('parses a valid state object', () => {
    const state = {
      workflowId: 'wf-bug',
      stateId: 'testing',
      category: 'in_progress' as const,
    };
    expect(parseWorkItemState(state)).toEqual(state);
    expect(workItemStateSchema.parse(state)).toEqual(state);
  });

  it('falls back to legacy status when state is missing', () => {
    expect(
      resolveWorkItemState({ status: WorkItemStatusEnum.New })
    ).toMatchObject({
      workflowId: DEFAULT_WORKFLOW_ID,
      stateId: WorkItemStatusEnum.New,
      category: 'todo',
    });
  });
});

describe('legacyStatusFromWorkItemState', () => {
  it('returns stateId when it is a known status', () => {
    expect(
      legacyStatusFromWorkItemState(
        buildWorkItemStateFromLegacy({ status: WorkItemStatusEnum.Testing })
      )
    ).toBe(WorkItemStatusEnum.Testing);
  });

  it('uses a representative status when stateId is custom', () => {
    expect(
      legacyStatusFromWorkItemState({
        workflowId: 'wf-default',
        stateId: 'code-review',
        category: 'in_progress',
      })
    ).toBe(WorkItemStatusEnum.InProgress);
  });
});

describe('doneAtForCategoryChange', () => {
  const now = new Date('2026-04-01T12:00:00.000Z');

  it('sets done_at when entering done', () => {
    expect(
      doneAtForCategoryChange({
        previousCategory: 'in_progress',
        nextCategory: 'done',
        now,
      })
    ).toEqual(now);
  });

  it('clears done_at when leaving done', () => {
    expect(
      doneAtForCategoryChange({
        previousCategory: 'done',
        nextCategory: 'todo',
        now,
      })
    ).toBeNull();
  });

  it('leaves done_at unchanged within the same bucket', () => {
    expect(
      doneAtForCategoryChange({
        previousCategory: 'done',
        nextCategory: 'done',
        now,
      })
    ).toBeUndefined();
  });
});

describe('syncWorkItemStateForStatusChange', () => {
  it('records history when workflow id changes', () => {
    const previous = {
      workflowId: 'wf-default',
      stateId: WorkItemStatusEnum.ToDo,
      category: 'todo' as const,
    };
    const now = new Date('2026-04-02T08:00:00.000Z');
    const synced = syncWorkItemStateForStatusChange({
      nextStatus: WorkItemStatusEnum.InProgress,
      previousState: previous,
      workflowId: 'wf-bug',
      now,
    });

    expect(synced.state.workflowId).toBe('wf-bug');
    expect(synced.state.historyByWorkflow).toEqual({
      'wf-default': {
        stateId: WorkItemStatusEnum.ToDo,
        updatedAt: now.toISOString(),
      },
    });
    expect(synced.status).toBe(WorkItemStatusEnum.InProgress);
  });
});
