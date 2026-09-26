import { describe, expect, it } from 'vitest';
import {
  buildSprintReportBreadcrumbOverrides,
  parseSprintReportFrom,
  sprintReportBackNav,
  sprintReportHref,
} from '@/app/sprints/_helpers/sprint-report-links';

describe('sprint report links', () => {
  it('builds report hrefs with from context', () => {
    expect(sprintReportHref('sprint-1', 'sprints')).toBe(
      '/sprints/sprint-1/report?from=sprints'
    );
    expect(sprintReportHref('sprint-1', 'backlog')).toBe(
      '/sprints/sprint-1/report?from=backlog'
    );
    expect(sprintReportHref('sprint-1', 'board')).toBe(
      '/sprints/sprint-1/report?from=board'
    );
    expect(sprintReportHref('sprint-1', 'work-items')).toBe(
      '/sprints/sprint-1/report?from=work-items'
    );
    expect(sprintReportHref('sprint-1', 'project')).toBe(
      '/sprints/sprint-1/report?from=project'
    );
  });

  it('parses from query with backlog default', () => {
    expect(parseSprintReportFrom('sprints')).toBe('sprints');
    expect(parseSprintReportFrom('backlog')).toBe('backlog');
    expect(parseSprintReportFrom('board')).toBe('board');
    expect(parseSprintReportFrom('work-items')).toBe('work-items');
    expect(parseSprintReportFrom('project')).toBe('project');
    expect(parseSprintReportFrom(['sprints'])).toBe('sprints');
    expect(parseSprintReportFrom(undefined)).toBe('backlog');
    expect(parseSprintReportFrom('other')).toBe('backlog');
  });

  it('maps back navigation from context', () => {
    expect(sprintReportBackNav('sprints')).toEqual({
      href: '/sprints',
      label: 'Back to Sprints',
    });
    expect(
      sprintReportBackNav('project', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee')
    ).toEqual({
      href: '/projects/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee?tab=sprints',
      label: 'Back to Sprints',
    });
    expect(sprintReportBackNav('backlog')).toEqual({
      href: '/backlog',
      label: 'Back to Backlog',
    });
    expect(sprintReportBackNav('board')).toEqual({
      href: '/board',
      label: 'Back to Board',
    });
    expect(sprintReportBackNav('work-items')).toEqual({
      href: '/work-items',
      label: 'Back to Work Items',
    });
  });

  it('builds project-scoped breadcrumbs when the sprint has a project', () => {
    const projectId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    expect(
      buildSprintReportBreadcrumbOverrides(
        {
          id: 'sprint-1',
          name: 'Sprint 4',
          project: { id: projectId, name: 'Alice Platform', key: 'AP' },
        },
        'project'
      )
    ).toEqual([
      { label: 'Dashboard', url: '/dashboard' },
      { label: 'Projects', url: '/projects' },
      {
        label: 'Alice Platform',
        url: `/projects/${projectId}`,
      },
      {
        label: 'Sprints',
        url: `/projects/${projectId}?tab=sprints`,
      },
      {
        label: 'Sprint 4',
        url: '/sprints/sprint-1/report?from=project',
      },
    ]);
  });

  it('falls back to registry breadcrumbs without a project', () => {
    expect(
      buildSprintReportBreadcrumbOverrides(
        { id: 'sprint-1', name: 'Orphan Sprint', project: null },
        'sprints'
      )
    ).toEqual([
      { label: 'Dashboard', url: '/dashboard' },
      { label: 'Sprints', url: '/sprints' },
      {
        label: 'Orphan Sprint',
        url: '/sprints/sprint-1/report?from=sprints',
      },
    ]);
  });
});
