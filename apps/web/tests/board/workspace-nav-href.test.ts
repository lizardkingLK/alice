import { describe, expect, it } from 'vitest';
import {
  buildWorkspaceNavHref,
  isWorkspaceDefaultQueryPath,
} from '@/app/board/_services/board.defaults.shared';
import { ALL_PROJECTS_ID } from '@/app/board/_helpers/board-defaults-storage';

describe('buildWorkspaceNavHref', () => {
  it('returns bare path when preference is missing', () => {
    // Arrange
    const preference = null;

    // Act
    const href = buildWorkspaceNavHref('/work-items', preference);

    // Assert
    expect(href).toBe('/work-items');
  });

  it('leaves non-workspace routes unchanged', () => {
    // Arrange
    const preference = {
      projectId: 'proj-1',
      sprintId: 'sprint-1',
    };

    // Act
    const href = buildWorkspaceNavHref('/member', preference);

    // Assert
    expect(href).toBe('/member');
  });

  it('uses path masks when shortcodes are stored', () => {
    const preference = {
      projectId: 'proj-1',
      sprintId: 'sprint-1',
      projectKey: 'SCRUM',
      sprintSlug: 'sprint-1',
    };

    expect(buildWorkspaceNavHref('/board', preference)).toBe(
      '/board/projects/SCRUM/sprints/sprint-1'
    );
    expect(buildWorkspaceNavHref('/work-items', preference)).toBe(
      '/work-items/projects/SCRUM/sprints/sprint-1'
    );
    expect(buildWorkspaceNavHref('/backlog', preference)).toBe(
      '/backlog/projects/SCRUM'
    );
  });

  it('falls back to UUID query when shortcodes are missing', () => {
    const preference = {
      projectId: 'proj-1',
      sprintId: 'sprint-1',
    };

    expect(buildWorkspaceNavHref('/board', preference)).toBe(
      '/board?project=proj-1&sprint=sprint-1'
    );
    expect(buildWorkspaceNavHref('/work-items', preference)).toBe(
      '/work-items?project=proj-1&sprint=sprint-1'
    );
  });

  it('attaches project=all without sprint', () => {
    // Arrange
    const preference = {
      projectId: ALL_PROJECTS_ID,
      sprintId: null,
    };

    // Act
    const href = buildWorkspaceNavHref('/backlog', preference);

    // Assert
    expect(href).toBe('/backlog?project=all');
  });
});

describe('isWorkspaceDefaultQueryPath', () => {
  it('recognizes workspace filter routes', () => {
    // Arrange
    const workspacePaths = ['/backlog', '/board', '/work-items'] as const;
    const nonWorkspacePath = '/member';

    // Act
    const workspaceResults = workspacePaths.map((path) =>
      isWorkspaceDefaultQueryPath(path)
    );
    const memberResult = isWorkspaceDefaultQueryPath(nonWorkspacePath);

    // Assert
    expect(workspaceResults).toEqual([true, true, true]);
    expect(memberResult).toBe(false);
  });
});
