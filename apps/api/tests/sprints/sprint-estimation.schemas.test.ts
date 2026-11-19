import { describe, expect, it } from 'vitest';
import {
  sprintEstimationResponseSchema,
  sprintEstimationInputSchema,
  sprintWorkItemEstimateSchema,
} from '@repo/types';

const WORK_ITEM_ID = '11111111-1111-4111-8111-111111111111';
const PROJECT_ID = '22222222-2222-4222-8222-222222222222';
const ASSIGNEE_ID = '33333333-3333-4333-8333-333333333333';

describe('sprint estimation contracts', () => {
  it('accepts a valid estimation input', () => {
    const parsed = sprintEstimationInputSchema.safeParse({
      workItem: {
        id: WORK_ITEM_ID,
        projectId: PROJECT_ID,
        type: 'Task',
        priority: 'high',
        severity: 'Major',
        storyPoints: 5,
        assigneeId: ASSIGNEE_ID,
        assigneeSeniority: 'Senior',
      },
      history: [
        {
          projectId: PROJECT_ID,
          type: 'Task',
          priority: 'high',
          severity: 'Major',
          storyPoints: 3,
          assigneeId: ASSIGNEE_ID,
          assigneeSeniority: 'Senior',
          loggedHours: 6,
          completed: true,
        },
      ],
      previousSprintCompletions: [
        { committedStoryPoints: 20, completedStoryPoints: 18 },
      ],
    });

    expect(parsed.success).toBe(true);
  });

  it.each([
    { field: 'storyPoints', value: -1 },
    { field: 'storyPoints', value: 1.5 },
    { field: 'priority', value: 'urgent' },
  ])('rejects an invalid work-item $field', ({ field, value }) => {
    const parsed = sprintEstimationInputSchema.safeParse({
      workItem: {
        id: WORK_ITEM_ID,
        projectId: PROJECT_ID,
        type: 'Task',
        priority: 'medium',
        storyPoints: 3,
        assigneeId: null,
        [field]: value,
      },
      history: [],
      previousSprintCompletions: [],
    });

    expect(parsed.success).toBe(false);
  });

  it('rejects invalid historical and sprint-completion evidence', () => {
    const parsed = sprintEstimationInputSchema.safeParse({
      workItem: {
        id: WORK_ITEM_ID,
        projectId: PROJECT_ID,
        type: 'Task',
        priority: 'medium',
        storyPoints: 3,
        assigneeId: null,
      },
      history: [
        {
          projectId: PROJECT_ID,
          type: 'Task',
          priority: 'medium',
          storyPoints: 3,
          assigneeId: null,
          loggedHours: -2,
          completed: false,
        },
      ],
      previousSprintCompletions: [
        { committedStoryPoints: 0, completedStoryPoints: 0 },
      ],
    });

    expect(parsed.success).toBe(false);
  });

  it('accepts a valid estimate and rejects an inverted range', () => {
    const validEstimate = {
      workItemId: WORK_ITEM_ID,
      suggestedHours: 8,
      minimumHours: 6,
      maximumHours: 12,
      confidence: 'low',
      source: 'rough_fallback',
      evidenceCount: 0,
      roughEstimate: true,
      rationale: 'Rough estimate because historical evidence is insufficient.',
    } as const;

    expect(sprintWorkItemEstimateSchema.safeParse(validEstimate).success).toBe(
      true
    );
    expect(
      sprintWorkItemEstimateSchema.safeParse({
        ...validEstimate,
        minimumHours: 10,
        maximumHours: 6,
      }).success
    ).toBe(false);
  });

  it('represents AI estimates and deterministic fallbacks explicitly', () => {
    const baseEstimate = {
      workItemId: WORK_ITEM_ID,
      suggestedHours: 8,
      minimumHours: 6,
      maximumHours: 12,
      confidence: 'medium',
      source: 'similar_history',
      evidenceCount: 4,
      roughEstimate: false,
      rationale: 'Historical evidence supports this range.',
    } as const;

    expect(
      sprintEstimationResponseSchema.safeParse({
        sprintId: '44444444-4444-4444-8444-444444444444',
        aiStatus: 'partial_fallback',
        estimates: [
          {
            ...baseEstimate,
            estimationMethod: 'ai',
            fallbackReason: null,
          },
          {
            ...baseEstimate,
            workItemId: '55555555-5555-4555-8555-555555555555',
            estimationMethod: 'deterministic',
            fallbackReason: 'timeout',
          },
        ],
      }).success
    ).toBe(true);
  });

  it('rejects inconsistent AI and fallback response metadata', () => {
    const estimate = {
      workItemId: WORK_ITEM_ID,
      suggestedHours: 8,
      minimumHours: 6,
      maximumHours: 12,
      confidence: 'medium',
      source: 'similar_history',
      evidenceCount: 4,
      roughEstimate: false,
      rationale: 'Historical evidence supports this range.',
    } as const;

    expect(
      sprintEstimationResponseSchema.safeParse({
        sprintId: '44444444-4444-4444-8444-444444444444',
        aiStatus: 'generated',
        estimates: [
          {
            ...estimate,
            estimationMethod: 'deterministic',
            fallbackReason: null,
          },
        ],
      }).success
    ).toBe(false);

    expect(
      sprintEstimationResponseSchema.safeParse({
        sprintId: '44444444-4444-4444-8444-444444444444',
        aiStatus: 'empty',
        estimates: [
          { ...estimate, estimationMethod: 'ai', fallbackReason: null },
        ],
      }).success
    ).toBe(false);
  });
});
