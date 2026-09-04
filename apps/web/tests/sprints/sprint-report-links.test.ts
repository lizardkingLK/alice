import { describe, expect, it } from 'vitest';
import {
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
  });

  it('parses from query with backlog default', () => {
    expect(parseSprintReportFrom('sprints')).toBe('sprints');
    expect(parseSprintReportFrom('backlog')).toBe('backlog');
    expect(parseSprintReportFrom(['sprints'])).toBe('sprints');
    expect(parseSprintReportFrom(undefined)).toBe('backlog');
    expect(parseSprintReportFrom('other')).toBe('backlog');
  });

  it('maps back navigation from context', () => {
    expect(sprintReportBackNav('sprints')).toEqual({
      href: '/sprints',
      label: 'Back to Sprints',
    });
    expect(sprintReportBackNav('backlog')).toEqual({
      href: '/backlog',
      label: 'Back to Backlog',
    });
  });
});
