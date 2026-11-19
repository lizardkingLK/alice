import { describe, expect, it } from 'vitest';
import {
  currentDateInTimezone,
  parseReportUrlState,
  serializeReportUrlState,
} from '@/app/reports/_helpers/reports-url-state';

const PROJECT_ONE = '11111111-1111-4111-8111-111111111111';
const PROJECT_TWO = '22222222-2222-4222-8222-222222222222';
const SPRINT_ONE = '33333333-3333-4333-8333-333333333333';

describe('report URL state', () => {
  it('uses the current calendar date in the browser timezone by default', () => {
    const now = new Date('2026-10-20T20:00:00.000Z');

    expect(currentDateInTimezone(now, 'Asia/Colombo')).toBe('2026-10-21');
    expect(
      parseReportUrlState(new URLSearchParams(), {
        browserTimezone: 'Asia/Colombo',
        now,
        projectIds: [PROJECT_ONE, PROJECT_TWO],
        sprintIds: [SPRINT_ONE],
      })
    ).toEqual({
      reportDate: '2026-10-21',
      timezone: 'Asia/Colombo',
      projectIds: [],
      sprintIds: [],
      verbosity: 'standard',
    });
  });

  it('falls back to UTC when the browser timezone is invalid', () => {
    const now = new Date('2026-10-20T23:30:00.000Z');

    expect(
      parseReportUrlState(new URLSearchParams(), {
        browserTimezone: 'not/a-timezone',
        now,
        projectIds: [],
        sprintIds: [],
      })
    ).toMatchObject({ reportDate: '2026-10-20', timezone: 'UTC' });
  });

  it('reads valid URL filters and removes inaccessible IDs', () => {
    const params = new URLSearchParams({
      date: '2026-10-19',
      timezone: 'America/New_York',
      projects: `${PROJECT_TWO},aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`,
      sprints: SPRINT_ONE,
      verbosity: 'detailed',
    });

    expect(
      parseReportUrlState(params, {
        browserTimezone: 'UTC',
        now: new Date('2026-10-20T00:00:00.000Z'),
        projectIds: [PROJECT_ONE, PROJECT_TWO],
        sprintIds: [SPRINT_ONE],
      })
    ).toEqual({
      reportDate: '2026-10-19',
      timezone: 'America/New_York',
      projectIds: [PROJECT_TWO],
      sprintIds: [SPRINT_ONE],
      verbosity: 'detailed',
    });
  });

  it('serializes non-default filters for saved views', () => {
    const params = serializeReportUrlState({
      reportDate: '2026-10-20',
      timezone: 'Asia/Colombo',
      projectIds: [PROJECT_TWO, PROJECT_ONE],
      sprintIds: [SPRINT_ONE],
      verbosity: 'concise',
    });

    expect(params.get('date')).toBe('2026-10-20');
    expect(params.get('timezone')).toBe('Asia/Colombo');
    expect(params.get('projects')).toBe(`${PROJECT_TWO},${PROJECT_ONE}`);
    expect(params.get('sprints')).toBe(SPRINT_ONE);
    expect(params.get('verbosity')).toBe('concise');
  });
});
