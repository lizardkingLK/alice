import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { SprintReportDeliverables } from '@/app/sprints/[id]/report/sprint-report-deliverables';
import { STATUS_ORDER } from '@/app/work-items/_helpers/work-item-status';
import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';
import { workItemFactory } from '../factories/workItem.factory';

/* eslint-disable no-unused-vars -- callback signature */
type IsUserOnline = (userId: string) => boolean;
/* eslint-enable no-unused-vars */

const { isUserOnlineMock } = vi.hoisted(() => ({
  isUserOnlineMock: vi.fn<IsUserOnline>().mockReturnValue(false),
}));

vi.mock('@/components/realtime/realtime-provider', () => ({
  useRealtime: () => ({ isUserOnline: isUserOnlineMock }),
}));

const statusCounts = Object.fromEntries(
  STATUS_ORDER.map((status) => [status, { count: 0, points: 0 }])
);

function renderDeliverables(filteredWorkItems: DbWorkItem[]) {
  return render(
    <SprintReportDeliverables
      totalIssues={filteredWorkItems.length}
      activeFilter={null}
      setActiveFilter={vi.fn()}
      filteredWorkItems={filteredWorkItems}
      statusCounts={statusCounts}
    />
  );
}

function rowForAssignee(name: string): HTMLTableRowElement {
  const row = screen.getByText(name).closest('tr');
  if (!row) {
    throw new Error(`Expected a deliverable row for ${name}`);
  }
  return row;
}

describe('SprintReportDeliverables assignee presence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isUserOnlineMock.mockReturnValue(false);
  });

  it('shows presence only for online assignees', () => {
    isUserOnlineMock.mockImplementation(
      (userId) => userId === 'online-user-id'
    );
    const onlineItem = workItemFactory.build({
      id: 'online-item-id',
      assignee_id: 'online-user-id',
      assignee: {
        id: 'online-user-id',
        name: 'Online Assignee',
        email: 'online@example.com',
        profile_picture: null,
      },
    });
    const offlineItem = workItemFactory.build({
      id: 'offline-item-id',
      assignee_id: 'offline-user-id',
      assignee: {
        id: 'offline-user-id',
        name: 'Offline Assignee',
        email: 'offline@example.com',
        profile_picture: null,
      },
    });

    renderDeliverables([onlineItem, offlineItem]);

    expect(isUserOnlineMock).toHaveBeenCalledWith('online-user-id');
    expect(isUserOnlineMock).toHaveBeenCalledWith('offline-user-id');
    expect(
      within(rowForAssignee('Online Assignee')).getByLabelText('Online')
    ).toBeInTheDocument();
    expect(
      within(rowForAssignee('Offline Assignee')).queryByLabelText('Online')
    ).not.toBeInTheDocument();
  });

  it('keeps unassigned deliverables offline without checking a null user ID', () => {
    const unassignedItem = workItemFactory.build({
      id: 'unassigned-item-id',
      assignee_id: null,
      assignee: null,
    });

    renderDeliverables([unassignedItem]);

    expect(isUserOnlineMock).not.toHaveBeenCalledWith(null);
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
    expect(
      within(rowForAssignee('Unassigned')).queryByLabelText('Online')
    ).not.toBeInTheDocument();
  });
});
