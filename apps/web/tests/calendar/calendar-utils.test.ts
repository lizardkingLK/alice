import { describe, expect, it } from 'vitest';
import { ALL_OPTION } from '@/app/_shared/values';
import { QUERY_FILTER_ALL_VALUE } from '@/hooks/use-query-filter';
import {
  filterCalendarWorkItems,
  filterUnscheduledWorkItems,
  formatCalendarWorkItemDisplayKey,
  matchesCalendarWorkItemSearch,
  resolveWorkItemProjectKey,
} from '@/app/calendar/_components/calendar-utils';
import { workItemFactory } from '@/tests/factories/workItem.factory';

const filterOptions = {
  projectValue: QUERY_FILTER_ALL_VALUE,
  sprintValue: QUERY_FILTER_ALL_VALUE,
  assigneeId: ALL_OPTION,
  type: ALL_OPTION,
};

describe('calendar-utils filters', () => {
  it('includes only scheduled items in filterCalendarWorkItems', () => {
    const items = [
      workItemFactory.build({ id: 'scheduled', due_date: '2026-08-20' }),
      workItemFactory.build({ id: 'unscheduled', due_date: null }),
    ];

    const result = filterCalendarWorkItems(items, filterOptions);

    expect(result.map((item) => item.id)).toEqual(['scheduled']);
  });

  it('includes only unscheduled items in filterUnscheduledWorkItems', () => {
    const items = [
      workItemFactory.build({ id: 'scheduled', due_date: '2026-08-20' }),
      workItemFactory.build({ id: 'unscheduled', due_date: null }),
    ];

    const result = filterUnscheduledWorkItems(items, filterOptions);

    expect(result.map((item) => item.id)).toEqual(['unscheduled']);
  });

  it('applies the same project, sprint, assignee, and type filters to both lists', () => {
    const items = [
      workItemFactory.build({
        id: 'scheduled-match',
        due_date: '2026-08-20',
        project_id: 'project-a',
        assignee_id: 'user-a',
        type: 'Issue',
      }),
      workItemFactory.build({
        id: 'unscheduled-match',
        due_date: null,
        project_id: 'project-a',
        assignee_id: 'user-a',
        type: 'Issue',
      }),
      workItemFactory.build({
        id: 'scheduled-other-project',
        due_date: '2026-08-21',
        project_id: 'project-b',
      }),
      workItemFactory.build({
        id: 'unscheduled-other-project',
        due_date: null,
        project_id: 'project-b',
      }),
    ];

    const narrowedOptions = {
      projectValue: 'project-a',
      sprintValue: QUERY_FILTER_ALL_VALUE,
      assigneeId: 'user-a',
      type: 'Issue',
    };

    expect(
      filterCalendarWorkItems(items, narrowedOptions).map((item) => item.id)
    ).toEqual(['scheduled-match']);
    expect(
      filterUnscheduledWorkItems(items, narrowedOptions).map((item) => item.id)
    ).toEqual(['unscheduled-match']);
  });
});

describe('calendar work item display + search helpers', () => {
  const projects = [{ id: 'project-a', key: 'NURL' }];

  it('resolves project key from embed or project list', () => {
    const item = workItemFactory.build({
      id: 'abc123456789',
      project_id: 'project-a',
    });

    expect(resolveWorkItemProjectKey(item, projects)).toBe('NURL');
    expect(formatCalendarWorkItemDisplayKey(item, projects)).toBe('NURL-6789');
  });

  it('matches unscheduled search against title and display key', () => {
    const item = workItemFactory.build({
      id: 'abc123456789',
      project_id: 'project-a',
      title: 'Bug: Timezone Mismatch',
      due_date: null,
    });

    expect(matchesCalendarWorkItemSearch(item, 'timezone', projects)).toBe(
      true
    );
    expect(matchesCalendarWorkItemSearch(item, 'nurl-6789', projects)).toBe(
      true
    );
    expect(matchesCalendarWorkItemSearch(item, 'missing', projects)).toBe(
      false
    );
    expect(matchesCalendarWorkItemSearch(item, '   ', projects)).toBe(true);
  });
});
