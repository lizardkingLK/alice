import { beforeEach, describe, expect, it } from 'vitest';
import {
  BACKLOG_DEFAULT_ALLOCATION,
  BACKLOG_DEFAULT_CAPACITY,
  computeSprintCapacity,
  effectiveMemberCapacity,
  formatCapacityHeaderLabel,
  formatCapacityPercentLabel,
  formatCapacityPoints,
  isCapacityNearFull,
  isCapacityOver,
} from '@/app/backlog/_helpers/backlog-sprint-capacity';
import {
  BACKLOG_CAPACITY_DISPLAY_IDS,
  readBacklogCapacityDisplay,
  writeBacklogCapacityDisplay,
} from '@/app/backlog/_helpers/backlog-capacity-display-storage';

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

  it('formats capacity labels for header display', () => {
    expect(formatCapacityPoints(12)).toBe('12');
    expect(formatCapacityPoints(12.5)).toBe('12.5');

    const configured = computeSprintCapacity({
      projectId: 'proj-1',
      storyPoints: [12],
      teamMembers: [
        {
          projectId: 'proj-1',
          userId: 'u1',
          capacity: 40,
          allocation: 100,
        },
      ],
    });
    expect(formatCapacityHeaderLabel(configured)).toBe('12 / 40');
    expect(formatCapacityPercentLabel(configured)).toBe('30%');
    expect(isCapacityOver(configured)).toBe(false);
    expect(isCapacityNearFull(configured)).toBe(false);

    const over = computeSprintCapacity({
      projectId: 'proj-1',
      storyPoints: [50],
      teamMembers: [
        {
          projectId: 'proj-1',
          userId: 'u1',
          capacity: 40,
          allocation: 100,
        },
      ],
    });
    expect(isCapacityOver(over)).toBe(true);
    expect(formatCapacityHeaderLabel(over)).toBe('50 / 40');
    expect(formatCapacityPercentLabel(over)).toBe('125%');

    const unconfigured = computeSprintCapacity({
      projectId: 'proj-1',
      storyPoints: [8],
      teamMembers: [],
    });
    expect(formatCapacityHeaderLabel(unconfigured)).toBe('8 pts');
    expect(formatCapacityPercentLabel(unconfigured)).toBe('—');
  });
});

describe('backlog capacity display storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to bar and round-trips preferred modes', () => {
    expect(readBacklogCapacityDisplay(undefined)).toBe('bar');
    expect(readBacklogCapacityDisplay('user-1')).toBe('bar');

    for (const mode of BACKLOG_CAPACITY_DISPLAY_IDS) {
      writeBacklogCapacityDisplay('user-1', mode);
      expect(readBacklogCapacityDisplay('user-1')).toBe(mode);
    }

    writeBacklogCapacityDisplay(null, 'numbers');
    expect(readBacklogCapacityDisplay(null)).toBe('bar');
  });

  it('migrates legacy icon preference to bar', () => {
    localStorage.setItem(
      'alice:backlog-capacity-display:user-1',
      JSON.stringify('icon')
    );
    expect(readBacklogCapacityDisplay('user-1')).toBe('bar');
  });

  it('falls back to bar for corrupt storage', () => {
    localStorage.setItem(
      'alice:backlog-capacity-display:user-1',
      JSON.stringify('nope')
    );
    expect(readBacklogCapacityDisplay('user-1')).toBe('bar');
  });
});
