import { describe, it, expect } from 'vitest';
import { resolvePreferenceFromFilterDraft } from '@/app/board/_helpers/workspace-defaults-shared';

const SPRINTS = [
  { id: 's1', project: { id: 'p1' } },
  { id: 's2', project: { id: 'p2' } },
];

describe('resolvePreferenceFromFilterDraft', () => {
  it('clears storage for All projects with project intent', () => {
    expect(
      resolvePreferenceFromFilterDraft({
        intent: 'project',
        projectValue: 'all',
        sprintValue: 'all',
        sprints: SPRINTS,
      })
    ).toBeNull();
  });

  it('saves project with null sprint for project intent', () => {
    expect(
      resolvePreferenceFromFilterDraft({
        intent: 'project',
        projectValue: 'p1',
        sprintValue: 's1',
        sprints: SPRINTS,
      })
    ).toEqual({ projectId: 'p1', sprintId: null });
  });

  it('saves project and sprint for sprint intent', () => {
    expect(
      resolvePreferenceFromFilterDraft({
        intent: 'sprint',
        projectValue: 'all',
        sprintValue: 's2',
        sprints: SPRINTS,
      })
    ).toEqual({ projectId: 'p2', sprintId: 's2' });
  });

  it('saves project-only when sprint intent selects All sprints', () => {
    expect(
      resolvePreferenceFromFilterDraft({
        intent: 'sprint',
        projectValue: 'p1',
        sprintValue: 'all',
        sprints: SPRINTS,
      })
    ).toEqual({ projectId: 'p1', sprintId: null });
  });
});
