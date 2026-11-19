import { describe, it, expect } from 'vitest';
import { resolvePreferenceFromFilterDraft } from '@/app/board/_helpers/workspace-defaults-shared';

const PROJECTS = [
  { id: 'p1', key: 'ONE' },
  { id: 'p2', key: 'TWO' },
];

const SPRINTS = [
  { id: 's1', slug: 'sprint-1', project: { id: 'p1', key: 'ONE' } },
  { id: 's2', slug: 'sprint-2', project: { id: 'p2', key: 'TWO' } },
];

describe('resolvePreferenceFromFilterDraft', () => {
  it('clears storage for All projects with project intent', () => {
    expect(
      resolvePreferenceFromFilterDraft({
        intent: 'project',
        projectValue: 'all',
        sprintValue: 'all',
        projects: PROJECTS,
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
        projects: PROJECTS,
        sprints: SPRINTS,
      })
    ).toEqual({ projectId: 'p1', sprintId: null, projectKey: 'ONE' });
  });

  it('saves project and sprint for sprint intent', () => {
    expect(
      resolvePreferenceFromFilterDraft({
        intent: 'sprint',
        projectValue: 'all',
        sprintValue: 's2',
        projects: PROJECTS,
        sprints: SPRINTS,
      })
    ).toEqual({
      projectId: 'p2',
      sprintId: 's2',
      projectKey: 'TWO',
      sprintSlug: 'sprint-2',
    });
  });

  it('saves project-only when sprint intent selects All sprints', () => {
    expect(
      resolvePreferenceFromFilterDraft({
        intent: 'sprint',
        projectValue: 'p1',
        sprintValue: 'all',
        projects: PROJECTS,
        sprints: SPRINTS,
      })
    ).toEqual({ projectId: 'p1', sprintId: null, projectKey: 'ONE' });
  });
});
