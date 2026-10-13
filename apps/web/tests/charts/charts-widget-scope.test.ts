import { describe, expect, it } from 'vitest';
import type { ChartBoardWidgetInstance } from '@/app/charts/_components/charts.types';
import {
  boardFilterFromPreference,
  buildScopedFilters,
  burndownInsertNeedsScopePrompt,
  clearDimensionFiltersKeepingScope,
  clearInstanceScopeLocks,
  filtersFromBoardSelection,
  filtersFromWorkspaceScope,
  isWorkspaceScoped,
  requiresSprintOnCreate,
  resolveChartWidgetInsertAction,
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

  it('detects workspace scope', () => {
    expect(isWorkspaceScoped({ scope: null })).toBe(false);
    expect(isWorkspaceScoped({})).toBe(false);
    expect(
      isWorkspaceScoped({
        scope: { projectId: 'proj-1', sprintId: 'sprint-1' },
      })
    ).toBe(true);
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
      filtersFromWorkspaceScope({ projectId: 'proj-1', sprintId: 'sprint-1' })
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

  it('maps board Filter selection into widget filters', () => {
    expect(
      filtersFromBoardSelection({
        projectId: 'all',
        sprintId: null,
      }).projectId
    ).toBe('all');

    expect(
      boardFilterFromPreference({
        projectId: 'proj-1',
        sprintId: 'sprint-1',
      })
    ).toEqual({ projectId: 'proj-1', sprintId: 'sprint-1' });
  });

  it('prompts for burndown when Filter lacks project or sprint', () => {
    expect(
      burndownInsertNeedsScopePrompt({
        projectId: 'proj-1',
        sprintId: 'sprint-1',
      })
    ).toBe(false);
    expect(
      burndownInsertNeedsScopePrompt({ projectId: 'proj-1', sprintId: null })
    ).toBe(true);
    expect(
      burndownInsertNeedsScopePrompt({ projectId: 'all', sprintId: 'sprint-1' })
    ).toBe(true);
  });

  it('resolves insert actions for scoped vs mixed boards', () => {
    const filter = {
      projectId: 'proj-1',
      sprintId: 'sprint-1' as string | null,
    };
    expect(
      resolveChartWidgetInsertAction({
        typeId: 'chart',
        workspaceScope: { projectId: 'proj-1', sprintId: 'sprint-1' },
        activeBoardFilter: filter,
      }).type
    ).toBe('append-filters');

    expect(
      resolveChartWidgetInsertAction({
        typeId: 'numbers',
        workspaceScope: null,
        activeBoardFilter: filter,
      }).type
    ).toBe('append-plain');

    expect(
      resolveChartWidgetInsertAction({
        typeId: 'burndown',
        workspaceScope: null,
        activeBoardFilter: { projectId: 'proj-1', sprintId: null },
      }).type
    ).toBe('prompt-burndown');

    expect(
      resolveChartWidgetInsertAction({
        typeId: 'chart',
        workspaceScope: null,
        activeBoardFilter: filter,
      }).type
    ).toBe('append-filters');
  });

  it('clears dimension filters while keeping project/sprint', () => {
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

  it('strips legacy per-widget scopeLocked flags', () => {
    const instances: ChartBoardWidgetInstance[] = [
      {
        instanceId: 'w1',
        typeId: 'chart',
        scopeLocked: true,
        title: 'Tasks',
      },
      {
        instanceId: 'w2',
        typeId: 'chart',
        title: 'Open',
      },
    ];

    const next = clearInstanceScopeLocks(instances);
    expect(next[0]?.scopeLocked).toBeUndefined();
    expect(next[1]?.scopeLocked).toBeUndefined();
    expect(next[0]?.title).toBe('Tasks');
  });
});
