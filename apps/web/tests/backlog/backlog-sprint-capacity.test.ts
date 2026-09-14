import { describe, expect, it } from 'vitest';
import {
  BACKLOG_DEFAULT_ALLOCATION,
  BACKLOG_DEFAULT_CAPACITY,
  computeSprintCapacity,
  effectiveMemberCapacity,
} from '@/app/backlog/_helpers/backlog-sprint-capacity';

describe('backlog sprint capacity helpers', () => {
  it('applies default capacity and allocation', () => {
    expect(effectiveMemberCapacity(null, null)).toBe(
      BACKLOG_DEFAULT_CAPACITY * (BACKLOG_DEFAULT_ALLOCATION / 100)
    );
    expect(effectiveMemberCapacity(40, 50)).toBe(20);
  });

  it('sums configured team capacity and planned points', () => {
    const snapshot = computeSprintCapacity({
      projectId: 'proj-1',
      storyPoints: [5, 8, null],
      teamMembers: [
        {
          projectId: 'proj-1',
          userId: 'u1',
          capacity: 30,
          allocation: 100,
        },
        {
          projectId: 'proj-1',
          userId: 'u2',
          capacity: 20,
          allocation: 50,
        },
        {
          projectId: 'other',
          userId: 'u3',
          capacity: 99,
          allocation: 100,
        },
      ],
    });

    expect(snapshot.usedPoints).toBe(13);
    expect(snapshot.totalCapacity).toBe(40);
    expect(snapshot.hasConfiguredCapacity).toBe(true);
    expect(snapshot.percentUsed).toBe(33);
  });

  it('marks capacity unconfigured when members only use defaults', () => {
    const snapshot = computeSprintCapacity({
      projectId: 'proj-1',
      storyPoints: [12],
      teamMembers: [
        {
          projectId: 'proj-1',
          userId: 'u1',
          capacity: null,
          allocation: null,
        },
      ],
    });

    expect(snapshot.hasConfiguredCapacity).toBe(false);
    expect(snapshot.usedPoints).toBe(12);
  });
});
