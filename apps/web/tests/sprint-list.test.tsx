import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ReactNode } from 'react';
import { SprintList } from '@/app/sprints/_components/sprint-list';
import { updateSprintStatus, Sprint } from '@/app/sprints/_services/sprints.service';

vi.mock('@/app/sprints/_services/sprints.service', () => ({
  updateSprintStatus: vi.fn(),
}));

// Mock Dropdown Menu to avoid testing Radix internals in happy-dom environment
vi.mock('@repo/ui/components/ui/dropdown-menu', () => {
  return {
    DropdownMenu: ({ children }: { children: ReactNode }) => <div data-testid="dropdown-menu">{children}</div>,
    DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <div data-testid="dropdown-menu-trigger">{children}</div>,
    DropdownMenuContent: ({ children }: { children: ReactNode }) => <div data-testid="dropdown-menu-content">{children}</div>,
    DropdownMenuItem: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => {
      // Extract main status name from children when children is an array [status, indicator]
      const text = Array.isArray(children) ? children[0] : children;
      return (
        <button type="button" data-testid={`dropdown-item-${text}`} onClick={onClick}>
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

  it('handles status transition from dropdown menu selection', async () => {
    const onSprintUpdated = vi.fn();
    const updatedSprint: Sprint = { ...mockSprints[0]!, status: 'Completed' };
    vi.mocked(updateSprintStatus).mockResolvedValue(updatedSprint);

    render(
      <SprintList
        sprints={mockSprints}
        pagination={mockPagination}
        filterTab="active"
        onTabChange={vi.fn()}
        onPageChange={vi.fn()}
        onLimitChange={vi.fn()}
        onSprintUpdated={onSprintUpdated}
      />
    );

    // Find Completed dropdown item under Sprint Alpha's status dropdown menu and click it
    const completedBtn = screen.getAllByTestId('dropdown-item-Completed')[0];
    expect(completedBtn).toBeInTheDocument();

    fireEvent.click(completedBtn!);

    await waitFor(() => {
      expect(updateSprintStatus).toHaveBeenCalledWith('sprint-1', 'Completed');
    });

    expect(onSprintUpdated).toHaveBeenCalledWith(updatedSprint);
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
    fireEvent.change(select, { target: { value: '20' } });
    expect(onLimitChange).toHaveBeenCalledWith(20);

    // Check pagination buttons - page numbers 1, 2, 3 should exist.
    const page1Btn = screen.getByRole('button', { name: '1' });
    fireEvent.click(page1Btn);
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('triggers tab change callback', () => {
    const onTabChange = vi.fn();
    render(
      <SprintList
        sprints={mockSprints}
        pagination={mockPagination}
        filterTab="active"
        onTabChange={onTabChange}
        onPageChange={vi.fn()}
        onLimitChange={vi.fn()}
      />
    );

    // Target the Archived tab button inside the tabs container specifically
    const activeTab = screen.getByRole('button', { name: 'Active' });
    const tabContainer = activeTab.parentElement!;
    const archivedTabBtn = within(tabContainer).getByRole('button', { name: 'Archived' });

    fireEvent.click(archivedTabBtn);

    expect(onTabChange).toHaveBeenCalledWith('archived');
  });

  it('triggers add and edit sprint callbacks', () => {
    const onAddSprint = vi.fn();
    const onEditSprint = vi.fn();

    render(
      <SprintList
        sprints={mockSprints}
        pagination={mockPagination}
        filterTab="active"
        onTabChange={vi.fn()}
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
    expect(screen.getByText(/No active, upcoming, or completed sprints/i)).toBeInTheDocument();

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
});
