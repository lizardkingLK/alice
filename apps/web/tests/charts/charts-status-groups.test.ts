import { describe, expect, it } from 'vitest';
import { BOARD_WORK_ITEM_STATUSES } from '@repo/types';
import { buildChartStatusGroups } from '@/app/charts/_components/charts-status-grouped-table';
import type { ChartDrilldownTableItem } from '@/app/charts/_helpers/charts-analytics.ui';

function item(
  id: string,
  status: ChartDrilldownTableItem['status']
): ChartDrilldownTableItem {
  return {
    id,
    title: id,
    status,
    type: 'Task',
    priority: 'medium',
    assigneeId: null,
    assigneeName: null,
    assigneeAvatar: null,
    projectId: 'p',
    projectName: null,
    sprintId: null,
    sprintName: null,
  };
}

describe('buildChartStatusGroups', () => {
  it('keeps board status order and hides empty groups', () => {
    const groups = buildChartStatusGroups([
      item('1', 'Testing'),
      item('2', 'ToDo'),
      item('3', 'InProgress'),
      item('4', 'ToDo'),
    ]);

    expect(groups.map((group) => group.status)).toEqual([
      'ToDo',
      'InProgress',
      'Testing',
    ]);
    expect(groups[0]?.items).toHaveLength(2);
    expect(BOARD_WORK_ITEM_STATUSES.slice(0, 5)).toEqual([
      'New',
      'ToDo',
      'InProgress',
      'Testing',
      'Done',
    ]);
  });

  it('pins a focused status even when empty after search', () => {
    const groups = buildChartStatusGroups([item('1', 'ToDo')], 'New');
    expect(groups).toEqual([{ status: 'New', items: [] }]);
  });
});
