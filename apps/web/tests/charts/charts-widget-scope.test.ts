import { describe, expect, it } from 'vitest';
import type { ChartBoardWidgetInstance } from '@/app/charts/_components/charts.types';
import {
  buildScopedFilters,
  clearDimensionFiltersKeepingScope,
  requiresSprintOnCreate,
  updateChartWidgetScope,
  widgetTypeRequiresScope,
} from '@/app/charts/_helpers/charts-widget-scope';

describe('charts-widget-scope', () => {
  it('requires scope for chart and burndown types only', () => {
    expect(widgetTypeRequiresScope('chart')).toBe(true);
    expect(widgetTypeRequiresScope('burndown')).toBe(true);
    expect(widgetTypeRequiresScope('data-over-time')).toBe(true);
    expect(widgetTypeRequiresScope('numbers')).toBe(false);
  });

  it('requires sprint on create for burndown only', () => {
    expect(requiresSprintOnCreate('burndown')).toBe(true);
    expect(requiresSprintOnCreate('data-over-time')).toBe(true);
    expect(requiresSprintOnCreate('chart')).toBe(false);
  });

  it('builds clean scoped filters with optional sprint', () => {
    expect(buildScopedFilters({ projectId: 'proj-1', sprintId: null })).toEqual(
      {
        mode: 'quick',
        projectId: 'proj-1',
        rows: [],
        quickSelections: {
          project: 'proj-1',
          sprint: 'all',
          status: 'all',
          type: 'all',
          assignee: 'all',
          priority: 'all',
        },
      }
    );

    expect(
      buildScopedFilters({ projectId: 'proj-1', sprintId: 'sprint-1' })
    ).toEqual({
      mode: 'quick',
      projectId: 'proj-1',
      sprintId: 'sprint-1',
      rows: [],
      quickSelections: {
        project: 'proj-1',
        sprint: 'sprint-1',
        status: 'all',
        type: 'all',
        assignee: 'all',
        priority: 'all',
      },
    });
  });

  it('clears dimension filters while keeping locked project/sprint', () => {
    const kept = clearDimensionFiltersKeepingScope({
      mode: 'advanced',
      projectId: 'proj-1',
      sprintId: 'sprint-1',
      rows: [
        {
          id: 'row-1',
          column: 'status',
          condition: 'is',
          value: 'Done',
        },
      ],
      quickSelections: {
        project: 'proj-1',
        sprint: 'sprint-1',
        status: 'Done',
        type: 'Task',
        assignee: 'user-1',
        priority: 'high',
      },
    });

    expect(kept.projectId).toBe('proj-1');
    expect(kept.sprintId).toBe('sprint-1');
    expect(kept.rows).toEqual([]);
    expect(kept.quickSelections.status).toBe('all');
    expect(kept.quickSelections.assignee).toBe('all');
  });

  it('updates scope, drops dimension filters, and clears focused slice', () => {
    const instances: ChartBoardWidgetInstance[] = [
      {
        instanceId: 'w1',
        typeId: 'chart',
        scopeLocked: true,
        focusedSliceKey: 'Done',
        filters: {
          mode: 'quick',
          projectId: 'old-proj',
          sprintId: 'old-sprint',
          rows: [],
          quickSelections: {
            project: 'old-proj',
            sprint: 'old-sprint',
            status: 'Done',
            type: 'all',
            assignee: 'user-1',
            priority: 'all',
          },
        },
        title: 'Tasks',
        pieVariant: 'donut',
      },
    ];

    const next = updateChartWidgetScope(
      'w1',
      { projectId: 'new-proj', sprintId: 'new-sprint' },
      instances
    );

    expect(next[0]?.scopeLocked).toBe(true);
    expect(next[0]?.focusedSliceKey).toBeUndefined();
    expect(next[0]?.filters?.projectId).toBe('new-proj');
    expect(next[0]?.filters?.sprintId).toBe('new-sprint');
    expect(next[0]?.filters?.quickSelections.status).toBe('all');
    expect(next[0]?.filters?.quickSelections.assignee).toBe('all');
    expect(next[0]?.title).toBe('Tasks');
    expect(next[0]?.pieVariant).toBe('donut');
  });
});
