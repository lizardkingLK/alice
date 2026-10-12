import { describe, expect, it } from 'vitest';
import {
  burndownScopeFromSprint,
  selectBurndownSprint,
} from '@/app/dashboard/_helpers/burndown-scope';
import { ALL_PROJECTS_ID } from '@/app/board/_helpers/workspace-defaults-shared';
import { SprintStatusEnum } from '@repo/types';

const SPRINTS = [
  {
    id: 's-planned',
    name: 'Sprint Planned',
    status: SprintStatusEnum.Planned,
    project: { id: 'p1', name: 'Alpha' },
  },
  {
    id: 's-active',
    name: 'Sprint Active',
    status: SprintStatusEnum.Active,
    project: { id: 'p1', name: 'Alpha' },
  },
  {
    id: 's-other',
    name: 'Other Sprint',
    status: SprintStatusEnum.Active,
    project: { id: 'p2', name: 'Beta' },
  },
] as const;

describe('selectBurndownSprint', () => {
  it('prefers board-default sprint within the preferred project', () => {
    expect(
      selectBurndownSprint(SPRINTS, {
        projectId: 'p1',
        sprintId: 's-planned',
      })?.id
    ).toBe('s-planned');
  });

  it('falls back to Active then Planned when no sprint preference', () => {
    expect(
      selectBurndownSprint(SPRINTS, {
        projectId: 'p1',
        sprintId: null,
      })?.id
    ).toBe('s-active');
  });

  it('uses all sprints when project preference is All', () => {
    expect(
      selectBurndownSprint(SPRINTS, {
        projectId: ALL_PROJECTS_ID,
        sprintId: 's-other',
      })?.id
    ).toBe('s-other');
  });
});

describe('burndownScopeFromSprint', () => {
  it('maps project and sprint names for header labels', () => {
    expect(burndownScopeFromSprint(SPRINTS[1])).toEqual({
      projectName: 'Alpha',
      sprintName: 'Sprint Active',
      sprintId: 's-active',
    });
  });

  it('returns null labels when no sprint is selected', () => {
    expect(burndownScopeFromSprint(undefined)).toEqual({
      projectName: null,
      sprintName: null,
      sprintId: null,
    });
  });
});
