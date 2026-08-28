import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import WorkItemsTable from '@/app/work-items/_components/workItems-table';
import { loadWorkItemChildrenAction } from '@/app/work-items/_components/actions';
import {
  archiveWorkItem,
  purgeWorkItem,
  restoreWorkItem,
} from '@/app/work-items/_services/workItem.service.client';
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
import { assertDebouncedSearchRedirect } from '../helpers/assert-debounced-search';
import { paginationFactory } from '../factories/pagination.factory';

async function ensureFilterDialogOpen() {
  const existing = screen.queryByRole('dialog');
  if (existing) {
    return existing;
  }
  fireEvent.click(screen.getByRole('button', { name: /Open filters/i }));
  return screen.findByRole('dialog');
}

async function pickFilterFieldOption(fieldLabel: string, optionLabel: string) {
  await ensureFilterDialogOpen();
  fireEvent.click(screen.getByRole('button', { name: fieldLabel }));
  const checkbox = await screen.findByRole('checkbox', { name: optionLabel });
  fireEvent.click(checkbox);
}

async function applyFilterFieldOption(fieldLabel: string, optionLabel: string) {
  await pickFilterFieldOption(fieldLabel, optionLabel);
  fireEvent.click(screen.getByRole('button', { name: /^Okay$/i }));
}

vi.mock('next/navigation', () => import('../mocks/next-navigation'));

vi.mock(
  '@repo/ui/components/ui/dropdown-menu',
  () => import('../mocks/dropdown-menu')
);

vi.mock('@/app/work-items/_components/actions', () => ({
  loadWorkItemChildrenAction: vi.fn(),
}));

vi.mock('@/app/work-items/_services/workItem.service.client', () => ({
  archiveWorkItem: vi.fn(),
  restoreWorkItem: vi.fn(),
  purgeWorkItem: vi.fn(),
  countWorkItemDescendants: vi.fn().mockResolvedValue(0),
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
    currentUserRole: string;
    tab: 'active' | 'archived';
    search: string;
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    projectFilter: string;
    typeFilter: string;
    assigneeFilter: string;
    listView: 'flat' | 'hierarchy';
    lockedProjectId: string;
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
      lockedProjectId={overrides.lockedProjectId}
      currentUserId={overrides.currentUserId}
      currentUserRole={overrides.currentUserRole}
      tab={overrides.tab}
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
    vi.mocked(archiveWorkItem).mockReset();
    vi.mocked(restoreWorkItem).mockReset();
    vi.mocked(purgeWorkItem).mockReset();
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
      screen.getByText(/No available work items were found/i)
    ).toBeInTheDocument();
  });

  it('debounces search and navigates with search query', async () => {
    // Arrange
    await renderTable();

    // Act / Assert
    await assertDebouncedSearchRedirect({
      searchInput: screen.getByPlaceholderText(/Search work items/i),
      value: 'filters',
      expectedPath: '/work-items?search=filters&page=1',
      mockPush,
    });
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
    const projectId = projects[0]!.id;
    const assigneeId = projectMembers[0]!.id;
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

    // Act — project selection alone does not navigate
    await pickFilterFieldOption('Project', projects[0]!.name);
    expect(mockPush).not.toHaveBeenCalled();

    // Act — Okay applies staged filters
    fireEvent.click(screen.getByRole('button', { name: /^Okay$/i }));

    // Assert
    expect(mockPush).toHaveBeenCalledWith(
      `/work-items?project=${projectId}&page=1`
    );

    // Act — type (keeps previously applied project from optimistic state)
    mockPush.mockClear();
    await applyFilterFieldOption('Work type', 'Task');

    // Assert
    expect(mockPush).toHaveBeenCalledWith(
      `/work-items?project=${projectId}&type=Task&page=1`
    );

    // Act — assignee
    mockPush.mockClear();
    await applyFilterFieldOption('Assignee', projectMembers[0]!.name);

    // Assert
    expect(mockPush).toHaveBeenCalledWith(
      `/work-items?project=${projectId}&type=Task&assignee=${assigneeId}&page=1`
    );
  });

  it('discards staged filters when Close is clicked', async () => {
    // Arrange
    const projects = projectFactory.buildList(1);
    render(
      <WorkItemsTable
        projects={projects}
        projectMembers={userFactory.buildList(1)}
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

    // Act
    await pickFilterFieldOption('Project', projects[0]!.name);
    const footerClose = screen
      .getAllByRole('button', { name: /^Close$/i })
      .find((button) => !button.querySelector('svg'));
    fireEvent.click(footerClose!);

    // Assert
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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
      expect(screen.getByText('Child story')).toBeInTheDocument();
    });

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
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Expand subtasks/i })
      ).toBeInTheDocument();
    });
  });

  it('switches to the archived tab via the toolbar', async () => {
    await renderTable({ totalCount: 1, totalPages: 1 });

    fireEvent.click(screen.getByRole('button', { name: 'Archived' }));

    expect(mockPush).toHaveBeenCalledWith(
      '/work-items?recordStatus=archived&page=1'
    );
  });

  it('keeps project details tab=work-items when opening archived work items', async () => {
    configureNextNavigationMock({
      pathname: '/projects/proj-1',
      searchParams: { tab: 'work-items' },
    });

    await renderTable({
      totalCount: 1,
      totalPages: 1,
      lockedProjectId: 'proj-1',
      projectFilter: 'proj-1',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Archived' }));

    expect(mockPush).toHaveBeenCalledWith(
      '/projects/proj-1?tab=work-items&recordStatus=archived&page=1'
    );
  });

  it('archives a work item after confirmation', async () => {
    const item = workItemFactory.build({
      id: 'wi-archive',
      title: 'Archive me',
      updated_at: '2026-08-01T00:00:00Z',
    });
    vi.mocked(archiveWorkItem).mockResolvedValue(
      workItemFactory.build({
        ...item,
        record_status: 'archived',
      })
    );

    await renderTable({
      initialWorkItems: [item],
      currentUserId: 'user-1',
      currentUserRole: 'member',
      tab: 'active',
      totalCount: 1,
      totalPages: 1,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Archive',
      })
    );

    await waitFor(() => {
      expect(archiveWorkItem).toHaveBeenCalledWith(
        'wi-archive',
        '2026-08-01T00:00:00Z'
      );
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('restores from the archived tab without a confirm dialog when it has no parent', async () => {
    const item = workItemFactory.build({
      id: 'wi-restore',
      title: 'Restore me',
      record_status: 'archived',
      parent_id: null,
      updated_at: '2026-08-01T00:00:00Z',
    });
    vi.mocked(restoreWorkItem).mockResolvedValue(
      workItemFactory.build({
        ...item,
        record_status: 'active',
      })
    );

    await renderTable({
      initialWorkItems: [item],
      currentUserId: 'user-1',
      currentUserRole: 'member',
      tab: 'archived',
      totalCount: 1,
      totalPages: 1,
    });

    expect(
      screen.queryByRole('button', { name: /Add Work-Item/i })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));

    await waitFor(() => {
      expect(restoreWorkItem).toHaveBeenCalledWith(
        'wi-restore',
        '2026-08-01T00:00:00Z'
      );
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('warns before restoring a child that will unlink from its parent', async () => {
    const item = workItemFactory.build({
      id: 'wi-restore-child',
      title: 'Restore child',
      record_status: 'archived',
      parent_id: 'wi-parent',
      updated_at: '2026-08-01T00:00:00Z',
    });
    vi.mocked(restoreWorkItem).mockResolvedValue(
      workItemFactory.build({
        ...item,
        record_status: 'active',
        parent_id: null,
      })
    );

    await renderTable({
      initialWorkItems: [item],
      currentUserId: 'user-1',
      currentUserRole: 'member',
      tab: 'archived',
      totalCount: 1,
      totalPages: 1,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent(/unlink this work item from its parent/i);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Restore' }));

    await waitFor(() => {
      expect(restoreWorkItem).toHaveBeenCalledWith(
        'wi-restore-child',
        '2026-08-01T00:00:00Z'
      );
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('purges an archived work item when the actor is admin', async () => {
    const item = workItemFactory.build({
      id: 'wi-purge',
      title: 'Purge me',
      record_status: 'archived',
      parent_id: null,
    });
    vi.mocked(purgeWorkItem).mockResolvedValue(undefined);

    await renderTable({
      initialWorkItems: [item],
      currentUserId: 'user-admin',
      currentUserRole: 'admin',
      tab: 'archived',
      totalCount: 1,
      totalPages: 1,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Purge' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete permanently',
      })
    );

    await waitFor(() => {
      expect(purgeWorkItem).toHaveBeenCalledWith('wi-purge');
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('warns that purging a child unlinks it from its parent', async () => {
    const item = workItemFactory.build({
      id: 'wi-purge-child',
      title: 'Purge child',
      record_status: 'archived',
      parent_id: 'wi-parent',
    });
    vi.mocked(purgeWorkItem).mockResolvedValue(undefined);

    await renderTable({
      initialWorkItems: [item],
      currentUserId: 'user-admin',
      currentUserRole: 'admin',
      tab: 'archived',
      totalCount: 1,
      totalPages: 1,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Purge' }));

    expect(screen.getByRole('dialog')).toHaveTextContent(
      /unlinks it from its parent/i
    );

    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete permanently',
      })
    );

    await waitFor(() => {
      expect(purgeWorkItem).toHaveBeenCalledWith('wi-purge-child');
    });
  });
});
