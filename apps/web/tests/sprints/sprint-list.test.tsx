import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  within,
  waitFor,
} from '@testing-library/react';
import { SprintList } from '@/app/sprints/_components/sprint-list';
import { SprintsWorkspace } from '@/app/sprints/_components/sprints-workspace';
import {
  Sprint,
  hardDeleteSprint,
} from '@/app/sprints/_services/sprints.mutations.client';
import { updateSprintStatusWithOptimisticLock } from '@/app/sprints/_helpers/update-sprint-status-with-lock';
import { DeleteSprintWorkItemsActionEnum } from '@repo/types';
import { assertDebouncedSearchRedirect } from '../helpers/assert-debounced-search';

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock('@/app/sprints/_helpers/update-sprint-status-with-lock', () => ({
  updateSprintStatusWithOptimisticLock: vi.fn(),
}));

vi.mock(
  '@/app/sprints/_services/sprints.mutations.client',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@/app/sprints/_services/sprints.mutations.client')
      >();
    return {
      ...actual,
      hardDeleteSprint: vi.fn(),
    };
  }
);

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  usePathname: () => '/sprints',
  useSearchParams: () => ({
    get: (key: string) => {
      if (key === 'search') return '';
      if (key === 'tab') return 'active';
      return null;
    },
    toString: () => '',
  }),
}));

vi.mock('@/app/sprints/_components/sprint-form', () => ({
  SprintForm: ({
    onClose,
    onSuccess,
    sprintToEdit,
  }: {
    onClose?: () => void;
    onSuccess?: () => void;
    sprintToEdit?: Sprint | null;
  }) => (
    <div data-testid="mock-sprint-form">
      <span>
        Mock Sprint Form - {sprintToEdit ? sprintToEdit.name : 'Create'}
      </span>
      <button onClick={onClose}>Close Form</button>
      <button onClick={onSuccess}>Success Form</button>
    </div>
  ),
}));

vi.mock(
  '@repo/ui/components/ui/dropdown-menu',
  () => import('../mocks/dropdown-menu')
);

const mockSprints: Sprint[] = [
  {
    id: 'sprint-1',
    name: 'Sprint Alpha',
    goal: 'Goal Alpha',
    status: 'active' as const,
    startDate: '2026-07-01',
    endDate: '2026-07-14',
    createdBy: 'user-1',
    updatedBy: null,
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
    project: {
      id: 'proj-1',
      name: 'Project Alpha',
      key: 'PAL',
    },
  },
  {
    id: 'sprint-2',
    name: 'Sprint Beta',
    goal: '',
    status: 'planned' as const,
    startDate: '2026-07-15',
    endDate: '2026-07-28',
    createdBy: 'user-1',
    updatedBy: null,
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
    project: null,
  },
];

const mockPagination = {
  page: 1,
  limit: 10,
  totalCount: 2,
  totalPages: 1,
};

describe('SprintList Component', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders sprints list with details', () => {
    render(
      <SprintList
        sprints={mockSprints}
        pagination={mockPagination}
        filterTab="active"
        onPageChange={vi.fn()}
        onLimitChange={vi.fn()}
      />
    );

    // Verify Sprint names are rendered
    expect(screen.getByText('Sprint Alpha')).toBeInTheDocument();
    expect(screen.getByText('Sprint Beta')).toBeInTheDocument();

    // Verify project name for Sprint 1 (DataTable shows name under sprint title)
    expect(screen.getByText(/Project:/i)).toBeInTheDocument();
    expect(screen.getByText('Project Alpha')).toBeInTheDocument();

    // Verify goal is rendered for Sprint 1
    expect(screen.getByText('Goal Alpha')).toBeInTheDocument();
  });

  it('renders sprint status as read-only label even for managers and admins', () => {
    render(
      <SprintList
        sprints={mockSprints}
        pagination={mockPagination}
        filterTab="active"
        onPageChange={vi.fn()}
        onLimitChange={vi.fn()}
      />
    );

    // Verify that the status text is rendered within the respective rows
    const alphaRow = screen.getByText('Sprint Alpha').closest('tr')!;
    expect(within(alphaRow).getByText('Active')).toBeInTheDocument();

    const betaRow = screen.getByText('Sprint Beta').closest('tr')!;
    expect(within(betaRow).getByText('Planned')).toBeInTheDocument();

    // Verify that the status dropdown menu or triggers are not present/active
    expect(screen.queryByTestId('dropdown-menu')).not.toBeInTheDocument();
  });

  it('triggers pagination callbacks', () => {
    const onPageChange = vi.fn();
    const onLimitChange = vi.fn();

    // Renders multiple pages
    const multiPagePagination = {
      page: 2,
      limit: 5,
      totalCount: 12,
      totalPages: 3,
    };

    render(
      <SprintList
        sprints={mockSprints}
        pagination={multiPagePagination}
        filterTab="active"
        onPageChange={onPageChange}
        onLimitChange={onLimitChange}
      />
    );

    // Page selector rows per page drop-down
    const select = screen.getByRole('combobox');
    fireEvent.click(select);
    const option = screen.getByRole('option', { name: '20' });
    fireEvent.click(option);
    expect(onLimitChange).toHaveBeenCalledWith(20);

    // Check pagination buttons - page numbers 1, 2, 3 should exist.
    const page1Btn = screen.getByRole('button', { name: '1' });
    fireEvent.click(page1Btn);
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('handles tab changes', () => {
    render(
      <SprintsWorkspace
        sprints={mockSprints}
        pagination={mockPagination}
        projects={[]}
        filterTab="active"
        search=""
        userRole="admin"
      />
    );

    const activeTab = screen.getByRole('button', { name: 'Active' });
    const tabContainer = activeTab.parentElement!;
    const archivedBtn = within(tabContainer).getByRole('button', {
      name: 'Archived',
    });
    fireEvent.click(archivedBtn);

    expect(mockPush).toHaveBeenCalledWith('/sprints?tab=archived&page=1');
  });

  it('handles search input with debounced redirect', async () => {
    render(
      <SprintsWorkspace
        sprints={mockSprints}
        pagination={mockPagination}
        projects={[]}
        filterTab="active"
        search=""
        userRole="admin"
      />
    );

    await assertDebouncedSearchRedirect({
      searchInput: screen.getByPlaceholderText(/Search sprints/i),
      value: 'Alpha',
      expectedPath: '/sprints?search=Alpha&page=1',
      mockPush,
    });

    expect(mockPush).toHaveBeenCalledWith('/sprints?search=Alpha&page=1');
  });

  it('opens sprint form on Add Sprint button click', () => {
    render(
      <SprintsWorkspace
        sprints={mockSprints}
        pagination={mockPagination}
        projects={[]}
        filterTab="active"
        search=""
        userRole="admin"
      />
    );

    const addBtn = screen.getByRole('button', { name: /Add Sprint/i });
    fireEvent.click(addBtn);

    expect(screen.getByTestId('mock-sprint-form')).toBeInTheDocument();
  });

  it('triggers edit sprint callbacks', () => {
    const onEditSprint = vi.fn();

    render(
      <SprintList
        sprints={mockSprints}
        pagination={mockPagination}
        filterTab="active"
        onPageChange={vi.fn()}
        onLimitChange={vi.fn()}
        onEditSprint={onEditSprint}
      />
    );

    const editBtns = screen.getAllByRole('button', { name: 'Edit Sprint' });
    // First edit button belongs to Sprint Alpha
    fireEvent.click(editBtns[0]!);
    expect(onEditSprint).toHaveBeenCalledWith(mockSprints[0]);
  });

  it('displays loading spinner/message when loading', () => {
    render(
      <SprintList
        sprints={[]}
        pagination={{ page: 1, limit: 10, totalCount: 0, totalPages: 0 }}
        filterTab="active"
        onPageChange={vi.fn()}
        onLimitChange={vi.fn()}
        isLoading={true}
      />
    );

    expect(screen.getByText(/Loading sprints…/i)).toBeInTheDocument();
  });

  it('displays error message and handles retry', () => {
    const onRetry = vi.fn();
    render(
      <SprintList
        sprints={[]}
        pagination={{ page: 1, limit: 10, totalCount: 0, totalPages: 0 }}
        filterTab="active"
        onPageChange={vi.fn()}
        onLimitChange={vi.fn()}
        error="Something went wrong"
        onRetry={onRetry}
      />
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /Try again/i });
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalled();
  });

  it('displays appropriate empty state message', () => {
    const { rerender } = render(
      <SprintList
        sprints={[]}
        pagination={{ page: 1, limit: 10, totalCount: 0, totalPages: 0 }}
        filterTab="active"
        onPageChange={vi.fn()}
        onLimitChange={vi.fn()}
      />
    );

    expect(screen.getByText(/No sprints yet/i)).toBeInTheDocument();

    // Rerender with pagination totalCount = 5 but filteredSprints is empty
    rerender(
      <SprintList
        sprints={[]}
        pagination={{ page: 1, limit: 10, totalCount: 5, totalPages: 1 }}
        filterTab="active"
        onPageChange={vi.fn()}
        onLimitChange={vi.fn()}
      />
    );
    expect(
      screen.getByText(/No active, upcoming, or completed sprints/i)
    ).toBeInTheDocument();

    rerender(
      <SprintList
        sprints={[]}
        pagination={{ page: 1, limit: 10, totalCount: 5, totalPages: 1 }}
        filterTab="archived"
        onPageChange={vi.fn()}
        onLimitChange={vi.fn()}
      />
    );
    expect(screen.getByText(/No archived sprints/i)).toBeInTheDocument();
  });

  it('renders Archive button for sprints in active registry and triggers callback', () => {
    const onArchiveSprint = vi.fn();
    const testSprints: Sprint[] = [
      {
        id: 'sprint-completed',
        name: 'Completed Sprint',
        goal: null,
        status: 'closed' as const,
        startDate: '2026-07-01',
        endDate: '2026-07-14',
        createdBy: 'user-1',
        updatedBy: null,
        createdAt: '2026-07-01T00:00:00Z',
        updatedAt: '2026-07-01T00:00:00Z',
        project: null,
      },
      {
        id: 'sprint-ongoing',
        name: 'Ongoing Sprint',
        goal: null,
        status: 'active' as const,
        startDate: '2026-07-01',
        endDate: '2026-07-14',
        createdBy: 'user-1',
        updatedBy: null,
        createdAt: '2026-07-01T00:00:00Z',
        updatedAt: '2026-07-01T00:00:00Z',
        project: null,
      },
      {
        id: 'sprint-planned',
        name: 'Planned Sprint',
        goal: null,
        status: 'planned' as const,
        startDate: '2026-07-01',
        endDate: '2026-07-14',
        createdBy: 'user-1',
        updatedBy: null,
        createdAt: '2026-07-01T00:00:00Z',
        updatedAt: '2026-07-01T00:00:00Z',
        project: null,
      },
    ];

    render(
      <SprintList
        sprints={testSprints}
        pagination={{ page: 1, limit: 10, totalCount: 3, totalPages: 1 }}
        filterTab="active"
        onPageChange={vi.fn()}
        onLimitChange={vi.fn()}
        onArchiveSprint={onArchiveSprint}
      />
    );

    // Verify Archive button is rendered for Completed Sprint
    const completedLi = screen.getByText('Completed Sprint').closest('tr')!;
    const archiveBtn = within(completedLi).getByRole('button', {
      name: 'Archive Sprint',
    });
    expect(archiveBtn).toBeInTheDocument();

    // Verify Archive button is NOT rendered for Ongoing and Planned Sprint in active registry
    const ongoingLi = screen.getByText('Ongoing Sprint').closest('tr')!;
    expect(
      within(ongoingLi).queryByRole('button', { name: 'Archive Sprint' })
    ).not.toBeInTheDocument();

    const plannedLi = screen.getByText('Planned Sprint').closest('tr')!;
    expect(
      within(plannedLi).queryByRole('button', { name: 'Archive Sprint' })
    ).not.toBeInTheDocument();

    // Click the Archive button and check callback
    fireEvent.click(archiveBtn);
    expect(onArchiveSprint).toHaveBeenCalledWith(testSprints[0]);
  });

  it('renders Restore button only for Archived sprints and triggers callback', () => {
    const onRestoreSprint = vi.fn();
    const testSprints: Sprint[] = [
      {
        id: 'sprint-archived',
        name: 'Archived Sprint',
        goal: null,
        status: 'archived' as const,
        startDate: '2026-07-01',
        endDate: '2026-07-14',
        createdBy: 'user-1',
        updatedBy: null,
        createdAt: '2026-07-01T00:00:00Z',
        updatedAt: '2026-07-01T00:00:00Z',
        project: null,
      },
      {
        id: 'sprint-completed',
        name: 'Completed Sprint',
        goal: null,
        status: 'closed' as const,
        startDate: '2026-07-01',
        endDate: '2026-07-14',
        createdBy: 'user-1',
        updatedBy: null,
        createdAt: '2026-07-01T00:00:00Z',
        updatedAt: '2026-07-01T00:00:00Z',
        project: null,
      },
    ];

    render(
      <SprintList
        sprints={testSprints}
        pagination={{ page: 1, limit: 10, totalCount: 2, totalPages: 1 }}
        filterTab="archived"
        onPageChange={vi.fn()}
        onLimitChange={vi.fn()}
        onRestoreSprint={onRestoreSprint}
      />
    );

    // Verify Restore button is rendered for Archived Sprint
    const archivedLi = screen.getByText('Archived Sprint').closest('tr')!;
    const restoreBtn = within(archivedLi).getByRole('button', {
      name: 'Restore Sprint',
    });
    expect(restoreBtn).toBeInTheDocument();

    // Verify Restore button is NOT rendered for Completed Sprint
    const completedLi = screen.getByText('Completed Sprint').closest('tr')!;
    expect(
      within(completedLi).queryByRole('button', { name: 'Restore Sprint' })
    ).not.toBeInTheDocument();

    // Click the Restore button and check callback
    fireEvent.click(restoreBtn);
    expect(onRestoreSprint).toHaveBeenCalledWith(testSprints[0]);
  });

  it('does not render Edit button for Archived sprints', () => {
    const onEditSprint = vi.fn();
    const testSprints: Sprint[] = [
      {
        id: 'sprint-archived',
        name: 'Archived Sprint',
        goal: null,
        status: 'archived' as const,
        startDate: '2026-07-01',
        endDate: '2026-07-14',
        createdBy: 'user-1',
        updatedBy: null,
        createdAt: '2026-07-01T00:00:00Z',
        updatedAt: '2026-07-01T00:00:00Z',
        project: null,
      },
    ];

    render(
      <SprintList
        sprints={testSprints}
        pagination={{ page: 1, limit: 10, totalCount: 1, totalPages: 1 }}
        filterTab="archived"
        onPageChange={vi.fn()}
        onLimitChange={vi.fn()}
        onEditSprint={onEditSprint}
      />
    );

    // Verify Edit button is NOT rendered for Archived Sprint
    const archivedLi = screen.getByText('Archived Sprint').closest('tr')!;
    expect(
      within(archivedLi).queryByRole('button', { name: 'Edit Sprint' })
    ).not.toBeInTheDocument();
  });

  it('renders Delete button for Admin in Archived tab and triggers callback', () => {
    const onDeleteSprint = vi.fn();
    const testSprints: Sprint[] = [
      {
        id: 'sprint-archived',
        name: 'Archived Sprint',
        goal: null,
        status: 'archived' as const,
        startDate: '2026-07-01',
        endDate: '2026-07-14',
        createdBy: 'user-1',
        updatedBy: null,
        createdAt: '2026-07-01T00:00:00Z',
        updatedAt: '2026-07-01T00:00:00Z',
        project: null,
      },
    ];

    render(
      <SprintList
        sprints={testSprints}
        pagination={{ page: 1, limit: 10, totalCount: 1, totalPages: 1 }}
        filterTab="archived"
        isAdmin={true}
        onPageChange={vi.fn()}
        onLimitChange={vi.fn()}
        onDeleteSprint={onDeleteSprint}
      />
    );

    const archivedLi = screen.getByText('Archived Sprint').closest('tr')!;
    const deleteBtn = within(archivedLi).getByRole('button', {
      name: 'Delete Sprint',
    });
    expect(deleteBtn).toBeInTheDocument();

    fireEvent.click(deleteBtn);
    expect(onDeleteSprint).toHaveBeenCalledWith(testSprints[0]);
  });

  it('does not render Delete button for non-Admin in Archived tab', () => {
    const onDeleteSprint = vi.fn();
    const testSprints: Sprint[] = [
      {
        id: 'sprint-archived',
        name: 'Archived Sprint',
        goal: null,
        status: 'archived' as const,
        startDate: '2026-07-01',
        endDate: '2026-07-14',
        createdBy: 'user-1',
        updatedBy: null,
        createdAt: '2026-07-01T00:00:00Z',
        updatedAt: '2026-07-01T00:00:00Z',
        project: null,
      },
    ];

    render(
      <SprintList
        sprints={testSprints}
        pagination={{ page: 1, limit: 10, totalCount: 1, totalPages: 1 }}
        filterTab="archived"
        isAdmin={false}
        onPageChange={vi.fn()}
        onLimitChange={vi.fn()}
        onDeleteSprint={onDeleteSprint}
      />
    );

    const archivedLi = screen.getByText('Archived Sprint').closest('tr')!;
    expect(
      within(archivedLi).queryByRole('button', { name: 'Delete Sprint' })
    ).not.toBeInTheDocument();
  });

  it('renders Sprint Name cell as link navigating to sprint report view', () => {
    render(
      <SprintList
        sprints={mockSprints}
        pagination={mockPagination}
        filterTab="active"
        onPageChange={vi.fn()}
        onLimitChange={vi.fn()}
      />
    );

    const sprintLink = screen.getByRole('link', { name: /Sprint Alpha/i });
    expect(sprintLink).toBeInTheDocument();
    expect(sprintLink).toHaveAttribute(
      'href',
      '/sprints/sprint-1/report?from=sprints'
    );
  });

  it('opens archive modal for completed sprint and on confirm updates status to archived without moving to archive tab', async () => {
    const completedSprint: Sprint = {
      ...mockSprints[0]!,
      status: 'closed',
    };

    vi.mocked(updateSprintStatusWithOptimisticLock).mockResolvedValue({
      ...completedSprint,
      status: 'archived',
    });

    render(
      <SprintsWorkspace
        sprints={[completedSprint]}
        pagination={mockPagination}
        projects={[]}
        filterTab="active"
        search=""
        userRole="admin"
      />
    );

    // Click Archive button on the completed sprint
    const archiveBtn = screen.getByRole('button', { name: 'Archive Sprint' });
    fireEvent.click(archiveBtn);

    // Modal should be open
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Are you sure you want to archive/i)
    ).toBeInTheDocument();

    // Confirm Archive
    const confirmBtn = within(dialog).getByRole('button', {
      name: 'Archive Sprint',
    });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(updateSprintStatusWithOptimisticLock).toHaveBeenCalledWith(
        expect.objectContaining({
          sprint: completedSprint,
          status: 'archived',
        })
      );
      // Ensure page does NOT automatically move to archive tab
      expect(mockPush).not.toHaveBeenCalledWith('/sprints?tab=archived&page=1');
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('opens delete modal for admin in archived tab with permanent delete notice and no move_out option', async () => {
    vi.mocked(hardDeleteSprint).mockResolvedValue({
      data: { id: 'sprint-archived' },
    } as never);

    const archivedSprints: Sprint[] = [
      {
        id: 'sprint-archived',
        name: 'Archived Sprint',
        goal: 'Goal',
        status: 'archived' as const,
        startDate: '2026-07-01',
        endDate: '2026-07-14',
        createdBy: 'user-1',
        updatedBy: null,
        createdAt: '2026-07-01T00:00:00Z',
        updatedAt: '2026-07-01T00:00:00Z',
        project: null,
      },
    ];

    render(
      <SprintsWorkspace
        sprints={archivedSprints}
        pagination={{ page: 1, limit: 10, totalCount: 1, totalPages: 1 }}
        projects={[]}
        filterTab="archived"
        search=""
        userRole="admin"
      />
    );

    const deleteBtn = screen.getByRole('button', { name: 'Delete Sprint' });
    fireEvent.click(deleteBtn);

    // Delete confirmation dialog should open
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByText(/Are you sure you want to permanently delete/i)
    ).toBeInTheDocument();
    // Ensure "Move all work items out of the sprint" option is REMOVED
    expect(
      screen.queryByText('Move all work items out of the sprint')
    ).not.toBeInTheDocument();
    // Ensure "Delete all work-item content with sprint" notice is present
    expect(
      screen.getByText('Delete all work-item content with sprint')
    ).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', {
      name: 'Delete Permanently',
    });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(hardDeleteSprint).toHaveBeenCalledWith('sprint-archived', {
        workItemsAction: DeleteSprintWorkItemsActionEnum.DeleteContent,
      });
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('restores an archived sprint back to closed status and refreshes list', async () => {
    const archivedSprint: Sprint = {
      id: 'sprint-archived',
      name: 'Archived Sprint',
      goal: 'Goal',
      status: 'archived' as const,
      startDate: '2026-07-01',
      endDate: '2026-07-14',
      createdBy: 'user-1',
      updatedBy: null,
      createdAt: '2026-07-01T00:00:00Z',
      updatedAt: '2026-07-01T00:00:00Z',
      project: null,
    };

    vi.mocked(updateSprintStatusWithOptimisticLock).mockResolvedValue({
      ...archivedSprint,
      status: 'closed',
    });

    render(
      <SprintsWorkspace
        sprints={[archivedSprint]}
        pagination={{ page: 1, limit: 10, totalCount: 1, totalPages: 1 }}
        projects={[]}
        filterTab="archived"
        search=""
        userRole="admin"
      />
    );

    const restoreBtn = screen.getByRole('button', { name: 'Restore Sprint' });
    fireEvent.click(restoreBtn);

    await waitFor(() => {
      expect(updateSprintStatusWithOptimisticLock).toHaveBeenCalledWith(
        expect.objectContaining({
          sprint: archivedSprint,
          status: 'closed',
        })
      );
      expect(mockRefresh).toHaveBeenCalled();
    });
  });
});
