import { describe, expect, it } from 'vitest';
import {
  buildWorkspaceNavHref,
  isWorkspaceDefaultQueryPath,
} from '@/app/board/_services/board-defaults';
import { ALL_PROJECTS_ID } from '@/app/board/_helpers/board-defaults-storage';

describe('buildWorkspaceNavHref', () => {
  it('returns bare path when preference is missing', () => {
    expect(buildWorkspaceNavHref('/work-items', null)).toBe('/work-items');
  });

  it('leaves non-workspace routes unchanged', () => {
    expect(
      buildWorkspaceNavHref('/member', {
        projectId: 'proj-1',
        sprintId: 'sprint-1',
      })
    ).toBe('/member');
  });

  it('attaches project and sprint query params', () => {
    expect(
      buildWorkspaceNavHref('/board', {
        projectId: 'proj-1',
        sprintId: 'sprint-1',
      })
    ).toBe('/board?project=proj-1&sprint=sprint-1');
  });

  it('attaches project=all without sprint', () => {
    expect(
      buildWorkspaceNavHref('/backlog', {
        projectId: ALL_PROJECTS_ID,
        sprintId: null,
      })
    ).toBe('/backlog?project=all');
  });
});

describe('isWorkspaceDefaultQueryPath', () => {
  it('recognizes workspace filter routes', () => {
    expect(isWorkspaceDefaultQueryPath('/backlog')).toBe(true);
    expect(isWorkspaceDefaultQueryPath('/board')).toBe(true);
    expect(isWorkspaceDefaultQueryPath('/work-items')).toBe(true);
    expect(isWorkspaceDefaultQueryPath('/member')).toBe(false);
  });
});
