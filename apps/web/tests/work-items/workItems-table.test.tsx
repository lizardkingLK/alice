import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WorkItemsTable from '@/app/work-items/_components/workItems-table';
import { loadWorkItemChildrenAction } from '@/app/work-items/_components/actions';
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
import { pickComboboxOption } from '../helpers/pick-combobox-option';

vi.mock('next/navigation', () => import('../mocks/next-navigation'));

vi.mock(
  '@repo/ui/components/ui/dropdown-menu',
  () => import('../mocks/dropdown-menu')
);

vi.mock('@/app/work-items/_components/actions', () => ({
  loadWorkItemChildrenAction: vi.fn(),
}));

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

async function waitForColumnsHydrated() {
  await waitFor(() => {
    expect(
      screen.queryByLabelText(/Loading work item columns/i)
    ).not.toBeInTheDocument();
  });
}

async function renderTable(
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
    listView: 'flat' | 'hierarchy';
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

  const view = render(
    <WorkItemsTable
      projects={projects}
      projectMembers={projectMembers}
      sprints={[]}
      initialWorkItems={
        overrides.initialWorkItems ?? workItemFactory.buildList(2)
      }
      totalCount={pagination.totalCount}
      page={pagination.page}
      limit={pagination.limit}
      totalPages={pagination.totalPages}
      search={overrides.search ?? ''}
      projectFilter={overrides.projectFilter ?? ''}
      sprintFilter=""
      typeFilter={overrides.typeFilter ?? ''}
      assigneeFilter={overrides.assigneeFilter ?? ''}
      listView={overrides.listView}
      currentUserId={overrides.currentUserId}
    />
  );
  await waitForColumnsHydrated();
  return view;
}

function arrangeEpicWithChildStory() {
  const epic = workItemFactory.build({
    id: 'epic-1',
    type: 'Epic',
    title: 'Parent epic',
    parent_id: null,
  });
  const story = workItemFactory.build({
    id: 'story-1',
    type: 'Story',
    title: 'Child story',
    parent_id: 'epic-1',
  });
  vi.mocked(loadWorkItemChildrenAction).mockImplementation(async (parentId) =>
    parentId === 'epic-1'
      ? { ok: true, children: [story] }
      : { ok: true, children: [] }
  );
  return { epic, story };
}

describe('WorkItemsTable', () => {
  beforeEach(() => {
    resetNextNavigationMock();
    configureNextNavigationMock({
      pathname: '/work-items',
      searchParams: {},
    });
    vi.mocked(loadWorkItemChildrenAction).mockReset();
  });

  it('renders work item rows with core columns', async () => {
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
      due_date: '2026-12-31',
      assignee_id: assignee.id,
      assignee: {
        id: assignee.id,
        name: assignee.name,
        email: assignee.email,
      },
    });

    // Act
    await renderTable({
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
    expect(screen.getByText('GB')).toBeInTheDocument();
    expect(screen.getByText(formatDate('2026-12-31'))).toBeInTheDocument();
  });

  it('shows Labels column only after Columns dialog Save', async () => {
    await renderTable({
      currentUserId: 'user-columns',
      initialWorkItems: [
        workItemFactory.build({
          title: 'Labeled item',
          labels: ['Mobile'],
        }),
      ],
      totalCount: 1,
      totalPages: 1,
    });

    expect(
      screen.queryByRole('columnheader', { name: 'Labels' })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Customize columns/i }));

    const labelsCheckbox = await screen.findByRole('checkbox', {
      name: /Labels/i,
    });
    fireEvent.click(labelsCheckbox);

    expect(
      screen.queryByRole('columnheader', { name: 'Labels' })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    expect(
      screen.getByRole('columnheader', { name: 'Labels' })
    ).toBeInTheDocument();
    expect(screen.getAllByText('Mobile').length).toBeGreaterThanOrEqual(1);
  });

  it('keeps Title required in the Columns dialog', async () => {
    await renderTable({ currentUserId: 'user-columns' });

    fireEvent.click(screen.getByRole('button', { name: /Customize columns/i }));

    const titleCheckbox = await screen.findByRole('checkbox', {
      name: /Title/i,
    });
    expect(titleCheckbox).toBeDisabled();
    expect(titleCheckbox).toBeChecked();

    const actionsCheckbox = screen.getByRole('checkbox', {
      name: /Actions/i,
    });
    expect(actionsCheckbox).not.toBeDisabled();
  });

  it('shows Overdue pill for past due dates when status is not Done', async () => {
    const item = workItemFactory.build({
      title: 'Late story',
      status: 'InProgress',
      due_date: '2026-07-31',
    });

    await renderTable({
      initialWorkItems: [item],
      totalCount: 1,
      totalPages: 1,
    });

    const overdue = screen.getByText('Overdue');
    expect(overdue).toBeInTheDocument();
    expect(overdue.closest('[title]')).toHaveAttribute(
      'title',
      formatDate('2026-07-31')
    );
  });

  it('keeps plain due date for Done work items even when past due', async () => {
    const item = workItemFactory.build({
      title: 'Finished late',
      status: 'Done',
      due_date: '2026-07-31',
    });

    await renderTable({
      initialWorkItems: [item],
      totalCount: 1,
      totalPages: 1,
    });

    expect(screen.queryByText('Overdue')).not.toBeInTheDocument();
    expect(screen.getByText(formatDate('2026-07-31'))).toBeInTheDocument();
  });

  it('shows You badge when assignee is the current user', async () => {
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
    await renderTable({
      initialWorkItems: [item],
      currentUserId: currentUser.id,
      totalCount: 1,
      totalPages: 1,
    });

    // Assert
    expect(screen.getByText('You')).toBeInTheDocument();
    expect(screen.getByText(currentUser.name)).toBeInTheDocument();
  });

  it('omits avatar when work item is unassigned', async () => {
    // Arrange
    const item = workItemFactory.build({
      assignee_id: null,
      assignee: null,
    });

    // Act
    await renderTable({
      initialWorkItems: [item],
      totalCount: 1,
      totalPages: 1,
    });

    // Assert
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('shows empty state when there are no work items', async () => {
    // Arrange / Act
    await renderTable({
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
    await renderTable();

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

  it('navigates when pagination page or limit changes', async () => {
    // Arrange
    await renderTable({
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

  it('navigates when project type or assignee filters change', async () => {
    // Arrange
    const projects = projectFactory.buildList(1);
    const projectMembers = userFactory.buildList(1);
    render(
      <WorkItemsTable
        projects={projects}
        projectMembers={projectMembers}
        sprints={[]}
        initialWorkItems={workItemFactory.buildList(1)}
        totalCount={1}
        page={1}
        limit={10}
        totalPages={1}
        search=""
        projectFilter=""
        sprintFilter=""
        typeFilter=""
        assigneeFilter=""
      />
    );
    await waitForColumnsHydrated();

    // Act — project
    await pickComboboxOption({ name: /Filter by project/i }, projects[0]!.name);

    // Assert
    expect(mockPush).toHaveBeenCalledWith(
      `/work-items?project=${projects[0]!.id}&page=1`
    );

    // Act — type
    await pickComboboxOption({ name: /Filter by type/i }, 'Task');

    // Assert
    expect(mockPush).toHaveBeenCalledWith('/work-items?type=Task&page=1');

    // Act — assignee
    await pickComboboxOption(
      { name: /Filter by assignee/i },
      projectMembers[0]!.name
    );

    // Assert
    expect(mockPush).toHaveBeenCalledWith(
      `/work-items?assignee=${projectMembers[0]!.id}&page=1`
    );
  });

  it('opens create and edit dialogs with the mocked form', async () => {
    // Arrange
    const item = workItemFactory.build({ title: 'Editable item' });
    await renderTable({
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

  it('shows clear filters when URL has filters and clears them', async () => {
    // Arrange
    configureNextNavigationMock({
      pathname: '/work-items',
      searchParams: { search: 'ship', type: 'Task' },
    });
    await renderTable({ search: 'ship', typeFilter: 'Task' });

    // Assert — visible when filters are in the URL
    expect(
      screen.getByRole('button', { name: /Clear filters/i })
    ).toBeInTheDocument();

    // Act
    fireEvent.click(screen.getByRole('button', { name: /Clear filters/i }));

    // Assert — drops filter params (keeps bare path)
    expect(mockPush).toHaveBeenCalledWith('/work-items');
  });

  it('hides clear filters when URL has no filter params', async () => {
    // Arrange / Act
    await renderTable();

    // Assert
    expect(
      screen.queryByRole('button', { name: /Clear filters/i })
    ).not.toBeInTheDocument();
  });

  it('navigates to hierarchy view when Hierarchy is selected', async () => {
    // Arrange
    await renderTable();

    // Act
    fireEvent.click(screen.getByRole('button', { name: /^Hierarchy$/i }));

    // Assert
    expect(mockPush).toHaveBeenCalledWith('/work-items?view=hierarchy&page=1');
  });

  it('expands a root row and shows lazy-loaded children', async () => {
    // Arrange
    const { epic } = arrangeEpicWithChildStory();

    await renderTable({
      initialWorkItems: [epic],
      listView: 'hierarchy',
      totalCount: 1,
      totalPages: 1,
    });

    // Act
    fireEvent.click(screen.getByRole('button', { name: /Expand subtasks/i }));

    // Assert
    await waitFor(() => {
      expect(loadWorkItemChildrenAction).toHaveBeenCalledWith('epic-1');
    });
    expect(await screen.findByText('Child story')).toBeInTheDocument();

    // Act — collapse
    fireEvent.click(screen.getByRole('button', { name: /Collapse subtasks/i }));

    // Assert
    await waitFor(() => {
      expect(screen.queryByText('Child story')).not.toBeInTheDocument();
    });
  });

  it('shows an error and re-collapses the row when child loading fails', async () => {
    // Arrange
    const epic = workItemFactory.build({
      id: 'epic-1',
      type: 'Epic',
      title: 'Parent epic',
      parent_id: null,
    });
    vi.mocked(loadWorkItemChildrenAction).mockResolvedValue({
      ok: false,
      error: "You're not a member of this project.",
    });

    await renderTable({
      initialWorkItems: [epic],
      listView: 'hierarchy',
      totalCount: 1,
      totalPages: 1,
    });

    // Act
    fireEvent.click(screen.getByRole('button', { name: /Expand subtasks/i }));

    // Assert
    expect(
      await screen.findByText("You're not a member of this project.")
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: /Expand subtasks/i })
    ).toBeInTheDocument();
  });

  it('expands all and collapses all in hierarchy mode', async () => {
    // Arrange
    const { epic } = arrangeEpicWithChildStory();

    await renderTable({
      initialWorkItems: [epic],
      listView: 'hierarchy',
      totalCount: 1,
      totalPages: 1,
    });

    // Act
    fireEvent.click(screen.getByRole('button', { name: /Expand all/i }));

    // Assert
    expect(await screen.findByText('Child story')).toBeInTheDocument();

    // Act
    fireEvent.click(screen.getByRole('button', { name: /Collapse all/i }));

    // Assert
    await waitFor(() => {
      expect(screen.queryByText('Child story')).not.toBeInTheDocument();
    });
  });
});
