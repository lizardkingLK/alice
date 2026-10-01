import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChartsStatusGroupedTable } from '@/app/charts/_components/charts-status-grouped-table';
import type { ChartDrilldownTableItem } from '@/app/charts/_helpers/charts-analytics.ui';

const { isUserOnlineMock } = vi.hoisted(() => ({
  isUserOnlineMock: vi.fn((userId: string) => userId === 'online-user-id'),
}));

vi.mock('@/components/realtime/realtime-provider', () => ({
  useRealtime: () => ({ isUserOnline: isUserOnlineMock }),
}));

function item(
  id: string,
  assigneeId: string,
  assigneeName: string
): ChartDrilldownTableItem {
  return {
    id,
    title: `${assigneeName} task`,
    status: 'New',
    type: 'Task',
    priority: 'medium',
    assigneeId,
    assigneeName,
    assigneeAvatar: null,
    projectId: 'project-id',
    projectName: 'Project',
    sprintId: null,
    sprintName: null,
  };
}

describe('ChartsStatusGroupedTable presence', () => {
  it('shows presence only for online owners', () => {
    render(
      <ChartsStatusGroupedTable
        workItems={[
          item('online-item-id', 'online-user-id', 'Online Owner'),
          item('offline-item-id', 'offline-user-id', 'Offline Owner'),
        ]}
        visibleColumns={['owner']}
      />
    );

    expect(isUserOnlineMock).toHaveBeenCalledWith('online-user-id');
    expect(isUserOnlineMock).toHaveBeenCalledWith('offline-user-id');
    expect(
      within(screen.getByTitle('Online Owner')).getByLabelText('Online')
    ).toBeInTheDocument();
    expect(
      within(screen.getByTitle('Offline Owner')).queryByLabelText('Online')
    ).not.toBeInTheDocument();
  });
});
