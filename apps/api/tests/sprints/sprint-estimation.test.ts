import { describe, expect, it } from 'vitest';
import {
  estimateSprintWorkItem,
  median,
  type SprintEstimationHistoryItem,
  type SprintEstimationInput,
} from '@repo/types';

const WORK_ITEM_ID = '11111111-1111-4111-8111-111111111111';
const PROJECT_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_PROJECT_ID = '44444444-4444-4444-8444-444444444444';
const ASSIGNEE_ID = '33333333-3333-4333-8333-333333333333';

function historyItem(
  overrides: Partial<SprintEstimationHistoryItem> = {}
): SprintEstimationHistoryItem {
  return {
    projectId: PROJECT_ID,
    type: 'Task',
    priority: 'medium',
    severity: 'Major',
    storyPoints: 5,
    assigneeId: null,
    assigneeSeniority: null,
    loggedHours: 10,
    completed: true,
    ...overrides,
  };
}

function estimationInput(
  overrides: Partial<SprintEstimationInput> = {}
): SprintEstimationInput {
  return {
    workItem: {
      id: WORK_ITEM_ID,
      projectId: PROJECT_ID,
      type: 'Task',
      priority: 'medium',
      severity: 'Major',
      storyPoints: 5,
      assigneeId: null,
      assigneeSeniority: null,
    },
    history: [],
    previousSprintCompletions: [],
    ...overrides,
  };
}

describe('median', () => {
  it('calculates odd and even sample medians without mutating input', () => {
    const even = [9, 1, 5, 3];

    expect(median([9, 1, 3])).toBe(3);
    expect(median(even)).toBe(4);
    expect(even).toEqual([9, 1, 5, 3]);
  });

  it('returns null when no finite values are available', () => {
    expect(median([])).toBeNull();
    expect(median([Number.NaN, Number.POSITIVE_INFINITY])).toBeNull();
  });
});

describe('estimateSprintWorkItem', () => {
  it('uses median hours per point from similar completed work items', () => {
    const history = [
      historyItem({ storyPoints: 2, loggedHours: 4 }),
      historyItem({ storyPoints: 5, loggedHours: 10 }),
      historyItem({ storyPoints: 6, loggedHours: 12 }),
      historyItem({
        projectId: OTHER_PROJECT_ID,
        storyPoints: 5,
        loggedHours: 100,
      }),
      historyItem({ type: 'Story', storyPoints: 5, loggedHours: 50 }),
    ];

    const result = estimateSprintWorkItem(estimationInput({ history }));

    expect(result.suggestedHours).toBe(10);
    expect(result.source).toBe('similar_history');
    expect(result.evidenceCount).toBe(3);
    expect(result.confidence).toBe('medium');
    expect(result.roughEstimate).toBe(false);
    expect(result.rationale).toContain('median hours per story point');
  });

  it('prefers sufficient assignee-specific history and reaches high confidence', () => {
    const assigneeHistory = [8, 10, 12, 14, 16].map((loggedHours) =>
      historyItem({
        assigneeId: ASSIGNEE_ID,
        storyPoints: 5,
        loggedHours,
      })
    );
    const result = estimateSprintWorkItem(
      estimationInput({
        workItem: {
          ...estimationInput().workItem,
          assigneeId: ASSIGNEE_ID,
        },
        history: [
          ...assigneeHistory,
          historyItem({ loggedHours: 50 }),
          historyItem({ loggedHours: 60 }),
          historyItem({ loggedHours: 70 }),
        ],
      })
    );

    expect(result.suggestedHours).toBe(12);
    expect(result.source).toBe('assignee_history');
    expect(result.evidenceCount).toBe(5);
    expect(result.confidence).toBe('high');
  });

  it('uses broader same-project evidence with low confidence', () => {
    const result = estimateSprintWorkItem(
      estimationInput({
        history: [
          historyItem({ type: 'Story', loggedHours: 6 }),
          historyItem({ type: 'Story', loggedHours: 8 }),
          historyItem({ type: 'Issue', loggedHours: 10 }),
        ],
      })
    );

    expect(result.suggestedHours).toBe(8);
    expect(result.source).toBe('project_history');
    expect(result.confidence).toBe('low');
    expect(result.roughEstimate).toBe(false);
  });

  it('falls back when fewer than three valid historical samples exist', () => {
    const result = estimateSprintWorkItem(
      estimationInput({
        workItem: { ...estimationInput().workItem, storyPoints: 3 },
        history: [
          historyItem({ storyPoints: 3, loggedHours: 30 }),
          historyItem({ storyPoints: 3, loggedHours: 33 }),
        ],
      })
    );

    expect(result).toMatchObject({
      suggestedHours: 3,
      minimumHours: 2.5,
      maximumHours: 4.5,
      confidence: 'low',
      source: 'rough_fallback',
      evidenceCount: 0,
      roughEstimate: true,
    });
  });

  it('excludes zero-hour history from the evidence and median', () => {
    const result = estimateSprintWorkItem(
      estimationInput({
        history: [
          historyItem({ loggedHours: 0 }),
          historyItem({ loggedHours: 8 }),
          historyItem({ loggedHours: 10 }),
          historyItem({ loggedHours: 12 }),
        ],
      })
    );

    expect(result.suggestedHours).toBe(10);
    expect(result.evidenceCount).toBe(3);
    expect(result.confidence).toBe('medium');
  });

  it('uses median completed hours when story points are missing', () => {
    const result = estimateSprintWorkItem(
      estimationInput({
        workItem: { ...estimationInput().workItem, storyPoints: null },
        history: [
          historyItem({ storyPoints: null, loggedHours: 5 }),
          historyItem({ storyPoints: 2, loggedHours: 7 }),
          historyItem({ storyPoints: 8, loggedHours: 100 }),
        ],
      })
    );

    expect(result.suggestedHours).toBe(7);
    expect(result.source).toBe('similar_history');
    expect(result.roughEstimate).toBe(false);
  });

  it('handles missing severity and unknown assignee seniority safely', () => {
    const result = estimateSprintWorkItem(
      estimationInput({
        workItem: {
          ...estimationInput().workItem,
          severity: null,
          assigneeSeniority: 'Staff-plus-custom',
        },
        history: [
          historyItem({ severity: null, loggedHours: 8 }),
          historyItem({ severity: 'Critical', loggedHours: 10 }),
          historyItem({ severity: 'Minor', loggedHours: 12 }),
        ],
      })
    );

    expect(result.suggestedHours).toBe(10);
    expect(result.source).toBe('similar_history');
    expect(result.confidence).toBe('medium');
  });

  it('prefers matching-seniority experience over generic type history', () => {
    const matchingExperience = [8, 10, 12].map((loggedHours) =>
      historyItem({ assigneeSeniority: 'Senior', loggedHours })
    );
    const result = estimateSprintWorkItem(
      estimationInput({
        workItem: {
          ...estimationInput().workItem,
          assigneeSeniority: 'Senior',
        },
        history: [
          ...matchingExperience,
          historyItem({ assigneeSeniority: 'Junior', loggedHours: 40 }),
          historyItem({ assigneeSeniority: 'Junior', loggedHours: 50 }),
          historyItem({ assigneeSeniority: 'Junior', loggedHours: 60 }),
        ],
      })
    );

    expect(result.suggestedHours).toBe(10);
    expect(result.source).toBe('experience_history');
    expect(result.confidence).toBe('medium');
  });

  it('uses a type-based rough fallback when story points are missing', () => {
    const result = estimateSprintWorkItem(
      estimationInput({
        workItem: {
          ...estimationInput().workItem,
          type: 'Story',
          storyPoints: null,
        },
      })
    );

    expect(result.suggestedHours).toBe(8);
    expect(result.source).toBe('rough_fallback');
    expect(result.confidence).toBe('low');
    expect(result.rationale).toContain('type-based');
  });

  it('widens the upper range for low previous-sprint completion', () => {
    const result = estimateSprintWorkItem(
      estimationInput({
        workItem: { ...estimationInput().workItem, storyPoints: 8 },
        previousSprintCompletions: [
          { committedStoryPoints: 10, completedStoryPoints: 6 },
          { committedStoryPoints: 20, completedStoryPoints: 14 },
        ],
      })
    );

    expect(result.suggestedHours).toBe(8);
    expect(result.minimumHours).toBe(6);
    expect(result.maximumHours).toBe(14.5);
    expect(result.rationale).toContain('65% median sprint completion');
  });

  it('always returns ordered half-hour bounds within the documented limits', () => {
    const result = estimateSprintWorkItem(
      estimationInput({
        history: [
          historyItem({ storyPoints: 1, loggedHours: 2_000 }),
          historyItem({ storyPoints: 1, loggedHours: 3_000 }),
          historyItem({ storyPoints: 1, loggedHours: 4_000 }),
        ],
      })
    );

    expect(result.minimumHours).toBeGreaterThanOrEqual(0.5);
    expect(result.minimumHours).toBeLessThanOrEqual(result.suggestedHours);
    expect(result.suggestedHours).toBeLessThanOrEqual(result.maximumHours);
    expect(result.maximumHours).toBeLessThanOrEqual(1_000);
    expect(result.minimumHours * 2).toBe(Math.round(result.minimumHours * 2));
    expect(result.suggestedHours * 2).toBe(
      Math.round(result.suggestedHours * 2)
    );
    expect(result.maximumHours * 2).toBe(Math.round(result.maximumHours * 2));
  });
});
