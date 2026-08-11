import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WorkItemSidebar from '@/app/work-items/_components/workItem-details-sidebar';
import { workItemFactory } from '../factories/workItem.factory';
import type { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import type { WorkItemStatus } from '@repo/types';

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

type RenderSidebarOptions = {
  readonly workItem?: DbWorkItem;
  readonly childStatuses?: readonly WorkItemStatus[];
  readonly moreFieldsOpen?: boolean;
  // eslint-disable-next-line no-unused-vars -- open-change callback signature
  readonly setMoreFieldsOpen?: (open: boolean) => void;
};

function renderSidebar({
  workItem = workItemFactory.build({ status: 'InProgress' }),
  childStatuses = [],
  moreFieldsOpen = false,
  setMoreFieldsOpen = vi.fn(),
}: RenderSidebarOptions = {}) {
  return render(
    <WorkItemSidebar
      workItem={workItem}
      childStatuses={childStatuses}
      detailsOpen
      setDetailsOpen={vi.fn()}
      moreFieldsOpen={moreFieldsOpen}
      setMoreFieldsOpen={setMoreFieldsOpen}
      onWorkItemPatched={vi.fn()}
    />
  );
}

describe('WorkItemSidebar Done gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows acknowledgment when selecting Done with incomplete subtasks', () => {
    // Arrange
    renderSidebar({
      workItem: workItemFactory.build({ status: 'InProgress' }),
      childStatuses: ['Done', 'InProgress'],
    });

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
    renderSidebar({
      workItem: workItemFactory.build({ status: 'InProgress' }),
      childStatuses: ['Done', 'Done'],
    });

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
    renderSidebar({
      workItem: workItemFactory.build({ status: 'ToDo' }),
      childStatuses: [],
    });

    // Act
    fireEvent.click(screen.getByRole('button', { name: /^Done$/i }));

    // Assert
    expect(screen.queryByText('Cannot mark as Done')).not.toBeInTheDocument();
    expect(screen.getByTestId('field-patch-dialog')).toHaveTextContent(
      'Change Status'
    );
  });
});

describe('WorkItemSidebar sections', () => {
  it('renders Development between Details and More fields with mock criteria', () => {
    // Arrange
    renderSidebar();

    // Assert — section order + mock content lives under Development
    const details = screen.getByRole('button', { name: /^Details/i });
    const development = screen.getByRole('button', { name: /^Development/i });
    const moreFields = screen.getByRole('button', { name: /^More fields/i });

    expect(
      details.compareDocumentPosition(development) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      development.compareDocumentPosition(moreFields) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    expect(
      screen.getByText((content, element) => {
        return element?.textContent?.includes('1 branch') ?? false;
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText((content, element) => {
        return element?.textContent?.includes('1 pull request') ?? false;
      })
    ).toBeInTheDocument();
    expect(screen.getByText('Production')).toBeInTheDocument();
  });

  it('notifies parent when More fields is toggled', () => {
    // Arrange
    const setMoreFieldsOpen = vi.fn();
    renderSidebar({
      workItem: workItemFactory.build(),
      setMoreFieldsOpen,
    });

    // Act
    fireEvent.click(screen.getByRole('button', { name: /^More fields/i }));

    // Assert
    expect(setMoreFieldsOpen).toHaveBeenCalledWith(true);
  });
});
