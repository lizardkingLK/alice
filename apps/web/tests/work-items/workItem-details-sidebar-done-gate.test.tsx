import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WorkItemSidebar from '@/app/work-items/_components/workItem-details-sidebar';
import { workItemFactory } from '../factories/workItem.factory';

vi.mock(
  '@repo/ui/components/ui/dropdown-menu',
  () => import('../mocks/dropdown-menu')
);

vi.mock('@repo/ui/components/ui/sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock(
  '@/app/work-items/_components/workItem-field-patch-dialog',
  async () => {
    const actual = await vi.importActual<
      typeof import('@/app/work-items/_components/workItem-field-patch-dialog')
    >('@/app/work-items/_components/workItem-field-patch-dialog');
    return {
      ...actual,
      WorkItemFieldPatchDialog: ({
        open,
        fieldConfig,
      }: {
        open: boolean;
        fieldConfig: { title: string };
      }) =>
        open ? (
          <div data-testid="field-patch-dialog">{fieldConfig.title}</div>
        ) : null,
    };
  }
);

vi.mock('@/app/work-items/_components/work-item-time-tracking', () => ({
  WorkItemTimeTracking: () => <div data-testid="time-tracking" />,
}));

describe('WorkItemSidebar Done gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows acknowledgment when selecting Done with incomplete subtasks', () => {
    // Arrange
    const workItem = workItemFactory.build({ status: 'InProgress' });

    render(
      <WorkItemSidebar
        workItem={workItem}
        childStatuses={['Done', 'InProgress']}
        detailsOpen
        setDetailsOpen={vi.fn()}
        moreFieldsOpen={false}
        setMoreFieldsOpen={vi.fn()}
        onWorkItemPatched={vi.fn()}
      />
    );

    // Act
    fireEvent.click(screen.getByRole('button', { name: /^Done$/i }));

    // Assert
    expect(screen.getByText('Cannot mark as Done')).toBeInTheDocument();
    expect(
      screen.getByText(/1 subtask is still incomplete/i)
    ).toBeInTheDocument();
    expect(screen.queryByTestId('field-patch-dialog')).not.toBeInTheDocument();
  });

  it('opens status confirm when selecting Done and all subtasks are Done', () => {
    // Arrange
    const workItem = workItemFactory.build({ status: 'InProgress' });

    render(
      <WorkItemSidebar
        workItem={workItem}
        childStatuses={['Done', 'Done']}
        detailsOpen
        setDetailsOpen={vi.fn()}
        moreFieldsOpen={false}
        setMoreFieldsOpen={vi.fn()}
        onWorkItemPatched={vi.fn()}
      />
    );

    // Act
    fireEvent.click(screen.getByRole('button', { name: /^Done$/i }));

    // Assert
    expect(screen.queryByText('Cannot mark as Done')).not.toBeInTheDocument();
    expect(screen.getByTestId('field-patch-dialog')).toHaveTextContent(
      'Change Status'
    );
  });

  it('allows Done when there are no subtasks', () => {
    // Arrange
    const workItem = workItemFactory.build({ status: 'ToDo' });

    render(
      <WorkItemSidebar
        workItem={workItem}
        childStatuses={[]}
        detailsOpen
        setDetailsOpen={vi.fn()}
        moreFieldsOpen={false}
        setMoreFieldsOpen={vi.fn()}
        onWorkItemPatched={vi.fn()}
      />
    );

    // Act
    fireEvent.click(screen.getByRole('button', { name: /^Done$/i }));

    // Assert
    expect(screen.queryByText('Cannot mark as Done')).not.toBeInTheDocument();
    expect(screen.getByTestId('field-patch-dialog')).toBeInTheDocument();
  });
});
