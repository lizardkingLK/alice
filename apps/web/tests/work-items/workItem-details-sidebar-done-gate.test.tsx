import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WorkItemSidebar from '@/app/work-items/_components/workItem-details-sidebar';
import { workItemFactory } from '../factories/workItem.factory';
import type { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import type { WorkItemStatus } from '@repo/types';
import { linkPR } from '@/app/work-items/_services/workItem.service.client';

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

vi.mock('@/app/work-items/_services/workItem.service.client', () => ({
  getLinkedPRs: vi.fn().mockResolvedValue({
    prs: [
      {
        id: 'pr-1',
        pr_number: 1,
        pr_title: 'PR Title',
        pr_url: 'https://github.com/owner/repo/pull/1',
        status: 'open',
        branch_name: 'feature/branch',
        commits: [
          { sha: 'sha-1', message: 'commit msg', author: 'Carol', date: 'yesterday' }
        ]
      }
    ],
    githubRepo: 'owner/repo'
  }),
  linkPR: vi.fn(),
  unlinkPR: vi.fn(),
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
  it('renders Development between Details and More fields with mock criteria', async () => {
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

    expect(await screen.findByText('1 branch')).toBeInTheDocument();
    expect(screen.getByText('1 pull request')).toBeInTheDocument();
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

describe('WorkItemSidebar Link PR', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows validation error when linking PR from a mismatched repository', async () => {
    renderSidebar();
    await screen.findByText('1 pull request');

    // Expand PRs section
    const prToggle = await screen.findByText(/1 pull request/i);
    fireEvent.click(prToggle);

    // Open the dialog
    const linkButton = await screen.findByRole('button', { name: /link pull request/i });
    fireEvent.click(linkButton);

    // Verify dialog is open
    const input = screen.getByPlaceholderText('https://github.com/owner/repo/pull/123');
    expect(input).toBeInTheDocument();

    // Enter a mismatched PR URL
    fireEvent.change(input, { target: { value: 'https://github.com/mismatch-owner/mismatch-repo/pull/123' } });

    // Submit form
    const form = input.closest('form');
    fireEvent.submit(form!);

    // Assert validation error message is shown
    expect(
      await screen.findByText(/PR does not belong to the project's configured GitHub repository/i)
    ).toBeInTheDocument();

    // Verify linkPR was not called
    expect(linkPR).not.toHaveBeenCalled();
  });

  it('shows validation error when linking an invalid PR URL format', async () => {
    renderSidebar();
    await screen.findByText('1 pull request');

    // Expand PRs section
    const prToggle = await screen.findByText(/1 pull request/i);
    fireEvent.click(prToggle);

    // Open the dialog
    const linkButton = await screen.findByRole('button', { name: /link pull request/i });
    fireEvent.click(linkButton);

    const input = screen.getByPlaceholderText('https://github.com/owner/repo/pull/123');
    fireEvent.change(input, { target: { value: 'https://github.com/invalid-url' } });

    const form = input.closest('form');
    fireEvent.submit(form!);

    expect(
      await screen.findByText(/Invalid GitHub PR URL/i)
    ).toBeInTheDocument();

    expect(linkPR).not.toHaveBeenCalled();
  });

  it('successfully calls linkPR and closes dialog on valid PR URL', async () => {
    renderSidebar();
    await screen.findByText('1 pull request');

    // Expand PRs section
    const prToggle = await screen.findByText(/1 pull request/i);
    fireEvent.click(prToggle);

    // Open the dialog
    const linkButton = await screen.findByRole('button', { name: /link pull request/i });
    fireEvent.click(linkButton);

    const input = screen.getByPlaceholderText('https://github.com/owner/repo/pull/123');
    // Set to match 'owner/repo' which is mocked
    fireEvent.change(input, { target: { value: 'https://github.com/owner/repo/pull/123' } });

    const form = input.closest('form');
    fireEvent.submit(form!);

    expect(linkPR).toHaveBeenCalledWith(expect.any(String), 'https://github.com/owner/repo/pull/123');
  });
});
