import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import { ReactNode } from 'react';
import { SprintList } from '@/app/sprints/_components/sprint-list';
import { SprintsWorkspace } from '@/app/sprints/_components/sprints-workspace';
import { Sprint } from '@/app/sprints/_services/sprints.service';

const mockPush = vi.fn();
const mockRefresh = vi.fn();

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

// Mock Dropdown Menu to avoid testing Radix internals in happy-dom environment
vi.mock('@repo/ui/components/ui/dropdown-menu', () => {
  return {
    DropdownMenu: ({ children }: { children: ReactNode }) => (
      <div data-testid="dropdown-menu">{children}</div>
    ),
    DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
      <div data-testid="dropdown-menu-trigger">{children}</div>
    ),
    DropdownMenuContent: ({ children }: { children: ReactNode }) => (
      <div data-testid="dropdown-menu-content">{children}</div>
    ),
    DropdownMenuItem: ({
      children,
      onClick,
    }: {
      children: ReactNode;
      onClick?: () => void;
    }) => {
      // Extract main status name from children when children is an array [status, indicator]
      const text = Array.isArray(children) ? children[0] : children;
      return (
        <button
          type="button"
          data-testid={`dropdown-item-${text}`}
          onClick={onClick}
        >
          {children}
        </button>
      );
    },
  };
});

const mockSprints: Sprint[] = [
  {
    id: 'sprint-1',
    name: 'Sprint Alpha',
    goal: 'Goal Alpha',
    status: 'Ongoing' as const,
    startDate: '2026-07-01',
    endDate: '2026-07-14',
    createdBy: 'user-1',
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
    status: 'Not Started' as const,
    startDate: '2026-07-15',
    endDate: '2026-07-28',
    createdBy: 'user-1',
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
        onTabChange={vi.fn()}
        onPageChange={vi.fn()}
        onLimitChange={vi.fn()}
      />
    );

    // Verify Sprint names are rendered
    expect(screen.getByText('Sprint Alpha')).toBeInTheDocument();
    expect(screen.getByText('Sprint Beta')).toBeInTheDocument();

    // Verify project key for Sprint 1
    expect(screen.getByText('PAL')).toBeInTheDocument();

    // Verify project name for Sprint 1
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
        onTabChange={vi.fn()}
        onPageChange={vi.fn()}
        onLimitChange={vi.fn()}
      />
    );

    // Verify that the status text is rendered
    expect(screen.getByText('Ongoing')).toBeInTheDocument();
    expect(screen.getByText('Not Started')).toBeInTheDocument();

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
        onTabChange={vi.fn()}
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

    const searchInput = screen.getByPlaceholderText(/Search sprints/i);
    fireEvent.change(searchInput, { target: { value: 'Alpha' } });

    await waitFor(
      () => {
        expect(mockPush).toHaveBeenCalledWith('/sprints?search=Alpha&page=1');
      },
      { timeout: 500 }
    );
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

  it('triggers add and edit sprint callbacks', () => {
    const onAddSprint = vi.fn();
    const onEditSprint = vi.fn();

    render(
      <SprintList
        sprints={mockSprints}
        pagination={mockPagination}
        filterTab="active"
        onPageChange={vi.fn()}
        onLimitChange={vi.fn()}
        onAddSprint={onAddSprint}
        onEditSprint={onEditSprint}
      />
    );

    const addSprintBtn = screen.getByRole('button', { name: /Add Sprint/i });
    fireEvent.click(addSprintBtn);
    expect(onAddSprint).toHaveBeenCalled();

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
        onTabChange={vi.fn()}
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
        onTabChange={vi.fn()}
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
        onTabChange={vi.fn()}
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
        onTabChange={vi.fn()}
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
        onTabChange={vi.fn()}
        onPageChange={vi.fn()}
        onLimitChange={vi.fn()}
      />
    );
    expect(screen.getByText(/No archived sprints/i)).toBeInTheDocument();
  });

  it('renders Archive button only for Completed sprints and triggers callback', () => {
    const onArchiveSprint = vi.fn();
    const testSprints: Sprint[] = [
      {
        id: 'sprint-completed',
        name: 'Completed Sprint',
        goal: null,
        status: 'Completed' as const,
        startDate: '2026-07-01',
        endDate: '2026-07-14',
        createdBy: 'user-1',
        createdAt: '2026-07-01T00:00:00Z',
        updatedAt: '2026-07-01T00:00:00Z',
        project: null,
      },
      {
        id: 'sprint-ongoing',
        name: 'Ongoing Sprint',
        goal: null,
        status: 'Ongoing' as const,
        startDate: '2026-07-01',
        endDate: '2026-07-14',
        createdBy: 'user-1',
        createdAt: '2026-07-01T00:00:00Z',
        updatedAt: '2026-07-01T00:00:00Z',
        project: null,
      },
      {
        id: 'sprint-planned',
        name: 'Planned Sprint',
        goal: null,
        status: 'Not Started' as const,
        startDate: '2026-07-01',
        endDate: '2026-07-14',
        createdBy: 'user-1',
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
    const completedLi = screen.getByText('Completed Sprint').closest('li')!;
    const archiveBtn = within(completedLi).getByRole('button', {
      name: 'Archive Sprint',
    });
    expect(archiveBtn).toBeInTheDocument();

    // Verify Archive button is NOT rendered for Ongoing or Planned Sprint
    const ongoingLi = screen.getByText('Ongoing Sprint').closest('li')!;
    expect(
      within(ongoingLi).queryByRole('button', { name: 'Archive Sprint' })
    ).not.toBeInTheDocument();

    const plannedLi = screen.getByText('Planned Sprint').closest('li')!;
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
        status: 'Archived' as const,
        startDate: '2026-07-01',
        endDate: '2026-07-14',
        createdBy: 'user-1',
        createdAt: '2026-07-01T00:00:00Z',
        updatedAt: '2026-07-01T00:00:00Z',
        project: null,
      },
      {
        id: 'sprint-completed',
        name: 'Completed Sprint',
        goal: null,
        status: 'Completed' as const,
        startDate: '2026-07-01',
        endDate: '2026-07-14',
        createdBy: 'user-1',
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
    const archivedLi = screen.getByText('Archived Sprint').closest('li')!;
    const restoreBtn = within(archivedLi).getByRole('button', {
      name: 'Restore Sprint',
    });
    expect(restoreBtn).toBeInTheDocument();

    // Verify Restore button is NOT rendered for Completed Sprint
    const completedLi = screen.getByText('Completed Sprint').closest('li')!;
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
        status: 'Archived' as const,
        startDate: '2026-07-01',
        endDate: '2026-07-14',
        createdBy: 'user-1',
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
    const archivedLi = screen.getByText('Archived Sprint').closest('li')!;
    expect(
      within(archivedLi).queryByRole('button', { name: 'Edit Sprint' })
    ).not.toBeInTheDocument();
  });
});
