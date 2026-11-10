import { describe, expect, it } from 'vitest';
import {
  globalBacklogHref,
  globalBoardHref,
  globalMemberHref,
  globalWorkItemsHref,
  projectScopedHref,
} from '@/app/projects/_helpers/project-tree-links';

describe('projectScopedHref', () => {
  it('builds the project hub', () => {
    expect(projectScopedHref({ projectKeyOrId: 'scrum' })).toBe(
      '/projects/SCRUM'
    );
  });

  it('builds board, backlog, and member under the project', () => {
    expect(projectScopedHref({ projectKeyOrId: 'SCRUM', area: 'board' })).toBe(
      '/projects/SCRUM/board'
    );
    expect(
      projectScopedHref({ projectKeyOrId: 'SCRUM', area: 'backlog' })
    ).toBe('/projects/SCRUM/backlog');
    expect(projectScopedHref({ projectKeyOrId: 'SCRUM', area: 'member' })).toBe(
      '/projects/SCRUM/member'
    );
  });

  it('builds work-item and sprint summary-report paths with slugs', () => {
    expect(
      projectScopedHref({
        projectKeyOrId: 'SCRUM',
        area: 'work-items',
        workItemSlug: 'fix-login',
      })
    ).toBe('/projects/SCRUM/work-items/fix-login');
    expect(
      projectScopedHref({
        projectKeyOrId: 'SCRUM',
        area: 'sprints',
        sprintSlug: 'sprint-1',
        summaryReport: true,
      })
    ).toBe('/projects/SCRUM/sprints/sprint-1/summary-report');
    expect(
      projectScopedHref({
        projectKeyOrId: 'SCRUM',
        area: 'work-items',
        sprintSlug: 'sprint-1',
        workItemSlug: 'fix-login',
      })
    ).toBe('/projects/SCRUM/sprints/sprint-1/work-items/fix-login');
  });
});

describe('global filter path hrefs', () => {
  it('keeps bare roots without filters', () => {
    expect(globalBoardHref()).toBe('/board');
    expect(globalBacklogHref()).toBe('/backlog');
    expect(globalMemberHref()).toBe('/member');
    expect(globalWorkItemsHref()).toBe('/work-items');
  });

  it('moves project/sprint filters into the path', () => {
    expect(globalBoardHref({ projectKey: 'scrum' })).toBe(
      '/board/projects/SCRUM'
    );
    expect(
      globalBoardHref({ projectKey: 'SCRUM', sprintSlug: 'sprint-1' })
    ).toBe('/board/projects/SCRUM/sprints/sprint-1');
    expect(globalBacklogHref({ projectKey: 'SCRUM' })).toBe(
      '/backlog/projects/SCRUM'
    );
    expect(globalMemberHref({ projectKey: 'SCRUM' })).toBe(
      '/member/projects/SCRUM'
    );
    expect(globalWorkItemsHref({ projectKey: 'MS' })).toBe(
      '/work-items/projects/MS'
    );
    expect(
      globalWorkItemsHref({ projectKey: 'MS', sprintSlug: 'sprint-1' })
    ).toBe('/work-items/projects/MS/sprints/sprint-1');
  });
});
