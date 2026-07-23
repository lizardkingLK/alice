import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WorkItemsTable from '@/app/work-items/_components/workItems-table';
import type { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import { formatDate } from '@/app/_shared/utility';
import {
  mockPush,
  mockRefresh,
  configureNextNavigationMock,
  resetNextNavigationMock,
} from '../mocks/next-navigation';
import { userFactory } from '../factories/user.factory';
import { projectFactory } from '../factories/project.factory';
import { workItemFactory } from '../factories/workItem.factory';
import { paginationFactory } from '../factories/pagination.factory';

vi.mock('next/navigation', () => import('../mocks/next-navigation'));

vi.mock(
  '@repo/ui/components/ui/dropdown-menu',
  () => import('../mocks/dropdown-menu')
);

vi.mock('@/app/work-items/_components/workItem-form', () => ({
  WorkItemForm: ({
    onClose,
    onSuccess,
    itemToEdit,
  }: {
    onClose?: () => void;
    onSuccess?: () => void;
    itemToEdit?: DbWorkItem | null;
  }) => (
    <div data-testid="mock-work-item-form">
      <span>
        Mock Work Item Form - {itemToEdit ? itemToEdit.title : 'Create'}
      </span>
      <button type="button" onClick={onClose}>
        Close Form
      </button>
      <button type="button" onClick={onSuccess}>
        Success Form
      </button>
    </div>
  ),
}));

function renderTable(
  overrides: Partial<{
    initialWorkItems: DbWorkItem[];
    currentUserId: string | null;
    search: string;
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    projectFilter: string;
    typeFilter: string;
    assigneeFilter: string;
  }> = {}
) {
  const projects = projectFactory.buildList(1);
  const projectMembers = userFactory.buildList(1);
  const pagination = paginationFactory.build({
    ...(overrides.page !== undefined ? { page: overrides.page } : {}),
    ...(overrides.limit !== undefined ? { limit: overrides.limit } : {}),
    ...(overrides.totalCount !== undefined
      ? { totalCount: overrides.totalCount }
      : {}),
    ...(overrides.totalPages !== undefined
      ? { totalPages: overrides.totalPages }
      : {}),
  });

  return render(
    <WorkItemsTable
      projects={projects}
      projectMembers={projectMembers}
      initialWorkItems={
        overrides.initialWorkItems ?? workItemFactory.buildList(2)
      }
      totalCount={pagination.totalCount}
      page={pagination.page}
      limit={pagination.limit}
      totalPages={pagination.totalPages}
      search={overrides.search ?? ''}
      projectFilter={overrides.projectFilter ?? ''}
      typeFilter={overrides.typeFilter ?? ''}
      assigneeFilter={overrides.assigneeFilter ?? ''}
      currentUserId={overrides.currentUserId}
    />
  );
}

describe('WorkItemsTable', () => {
  beforeEach(() => {
    resetNextNavigationMock();
    configureNextNavigationMock({
      pathname: '/work-items',
      searchParams: {},
    });
  });

  it('renders work item rows with core columns', () => {
    // Arrange
    const assignee = userFactory.build({
      id: 'user-assignee',
      name: 'Gavin Belson',
    });
    const item = workItemFactory.build({
      title: 'Ship filters',
      type: 'Story',
      status: 'InProgress',
      priority: 'high',
      due_date: '2026-07-31',
      assignee_id: assignee.id,
      assignee: {
        id: assignee.id,
        name: assignee.name,
        email: assignee.email,
      },
    });

    // Act
    renderTable({
      initialWorkItems: [item],
      totalCount: 1,
      totalPages: 1,
    });

    // Assert
    expect(screen.getByText('Ship filters')).toBeInTheDocument();
    expect(screen.getByText('Story')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Gavin Belson')).toBeInTheDocument();
    expect(screen.getByText(formatDate('2026-07-31'))).toBeInTheDocument();
  });

  it('shows You badge when assignee is the current user', () => {
    // Arrange
    const currentUser = userFactory.build({ id: 'current-user' });
    const item = workItemFactory.build({
      assignee_id: currentUser.id,
      assignee: {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
      },
    });

    // Act
    renderTable({
      initialWorkItems: [item],
      currentUserId: currentUser.id,
      totalCount: 1,
      totalPages: 1,
    });

    // Assert
    expect(screen.getByText('You')).toBeInTheDocument();
  });

  it('shows empty state when there are no work items', () => {
    // Arrange / Act
    renderTable({
      initialWorkItems: [],
      totalCount: 0,
      totalPages: 0,
    });

    // Assert
    expect(
      screen.getByText(/No work items found matching your search/i)
    ).toBeInTheDocument();
  });

  it('debounces search and navigates with search query', async () => {
    // Arrange
    renderTable();

    // Act
    fireEvent.change(screen.getByPlaceholderText(/Search work items/i), {
      target: { value: 'filters' },
    });

    // Assert
    await waitFor(
      () => {
        expect(mockPush).toHaveBeenCalledWith(
          '/work-items?search=filters&page=1'
        );
      },
      { timeout: 500 }
    );
  });

  it('navigates when pagination page or limit changes', () => {
    // Arrange
    renderTable({
      page: 2,
      limit: 5,
      totalCount: 12,
      totalPages: 3,
    });

    // Act — rows per page
    const limitSelect = screen.getByRole('combobox', {
      name: /Rows per page/i,
    });
    fireEvent.click(limitSelect);
    fireEvent.click(screen.getByRole('option', { name: '20' }));

    // Assert
    expect(mockPush).toHaveBeenCalledWith('/work-items?page=1&limit=20');

    // Act — page button
    fireEvent.click(screen.getByRole('button', { name: '1' }));

    // Assert
    expect(mockPush).toHaveBeenCalledWith('/work-items?page=1&limit=5');
  });

  it('navigates when project type or assignee filters change', () => {
    // Arrange
    const projects = projectFactory.buildList(1);
    const projectMembers = userFactory.buildList(1);
    render(
      <WorkItemsTable
        projects={projects}
        projectMembers={projectMembers}
        initialWorkItems={workItemFactory.buildList(1)}
        totalCount={1}
        page={1}
        limit={10}
        totalPages={1}
        search=""
        projectFilter=""
        typeFilter=""
        assigneeFilter=""
      />
    );

    // Act — project
    fireEvent.click(
      screen.getByRole('combobox', { name: /Filter by project/i })
    );
    fireEvent.click(screen.getByRole('option', { name: projects[0]!.name }));

    // Assert
    expect(mockPush).toHaveBeenCalledWith(
      `/work-items?project=${projects[0]!.id}&page=1`
    );

    // Act — type
    fireEvent.click(screen.getByRole('combobox', { name: /Filter by type/i }));
    fireEvent.click(screen.getByRole('option', { name: 'Task' }));

    // Assert
    expect(mockPush).toHaveBeenCalledWith('/work-items?type=Task&page=1');

    // Act — assignee
    fireEvent.click(
      screen.getByRole('combobox', { name: /Filter by assignee/i })
    );
    fireEvent.click(
      screen.getByRole('option', { name: projectMembers[0]!.name })
    );

    // Assert
    expect(mockPush).toHaveBeenCalledWith(
      `/work-items?assignee=${projectMembers[0]!.id}&page=1`
    );
  });

  it('opens create and edit dialogs with the mocked form', () => {
    // Arrange
    const item = workItemFactory.build({ title: 'Editable item' });
    renderTable({
      initialWorkItems: [item],
      totalCount: 1,
      totalPages: 1,
    });

    // Act — create
    fireEvent.click(screen.getByRole('button', { name: /Add Work-Item/i }));

    // Assert — create
    expect(screen.getByText(/Create Work Item/i)).toBeInTheDocument();
    expect(screen.getByTestId('mock-work-item-form')).toHaveTextContent(
      'Create'
    );

    // Act — close then edit
    fireEvent.click(screen.getByRole('button', { name: /Close Form/i }));
    fireEvent.click(screen.getByRole('button', { name: /Open menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /Edit/i }));

    // Assert — edit
    expect(screen.getByText(/Edit Work Item/i)).toBeInTheDocument();
    expect(screen.getByTestId('mock-work-item-form')).toHaveTextContent(
      'Editable item'
    );

    // Act — success closes and refreshes
    fireEvent.click(screen.getByRole('button', { name: /Success Form/i }));

    // Assert
    expect(mockRefresh).toHaveBeenCalled();
    expect(screen.queryByTestId('mock-work-item-form')).not.toBeInTheDocument();
  });
});
