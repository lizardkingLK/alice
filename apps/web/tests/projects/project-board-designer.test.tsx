import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardDesignerWorkspace } from '@/app/projects/_components/project-details/board-designer-workspace';
import { updateProject } from '@/app/projects/_services/projects.mutations.client';
import { projectFactory } from '../factories/project.factory';
import { pickComboboxOption } from '../helpers/pick-combobox-option';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));
vi.mock('@/app/projects/_services/projects.mutations.client', () => ({
  updateProject: vi.fn(),
}));
vi.mock('@repo/ui/components/ui/sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const customConfig = {
  version: '1' as const,
  columns: [
    { id: 'backlog', name: 'Backlog', status: 'New' as const },
    { id: 'ready', name: 'Ready', status: 'ToDo' as const },
    { id: 'development', name: 'Development', status: 'InProgress' as const },
    { id: 'code-review', name: 'Code Review', status: 'InProgress' as const },
    { id: 'testing', name: 'Testing', status: 'Testing' as const },
    { id: 'done', name: 'Done', status: 'Done' as const },
  ],
};
const TEAM_ID = '764e1be5-67b4-43dc-a30c-0f66a07ba780';
const USER_ID = '1559d73c-a39f-452d-a275-e981dedff035';

function renderDesigner(
  canEdit = true,
  workflowConfig: unknown = customConfig
) {
  const project = projectFactory.build({
    workflow_config: workflowConfig as never,
  });
  vi.mocked(updateProject).mockResolvedValue({
    ...project,
    updated_at: '2026-09-11T01:00:00.000Z',
  });
  return render(
    <BoardDesignerWorkspace
      project={project}
      canEdit={canEdit}
      currentUserId="actor-1"
      teams={[{ id: TEAM_ID, name: 'QA Team' }]}
      members={[
        {
          userId: USER_ID,
          name: 'Alice Reviewer',
          email: 'alice@example.com',
          role: 'member',
        },
      ]}
    />
  );
}

async function pickSelectValue(
  comboboxName: string | RegExp,
  optionName: string | RegExp
) {
  fireEvent.click(screen.getByRole('combobox', { name: comboboxName }));
  fireEvent.click(await screen.findByRole('option', { name: optionName }));
}

function createDataTransfer(): DataTransfer {
  const values = new Map<string, string>();
  return {
    effectAllowed: 'none',
    dropEffect: 'none',
    getData: vi.fn((format: string) => values.get(format) ?? ''),
    setData: vi.fn((format: string, value: string) => {
      values.set(format, value);
    }),
  } as unknown as DataTransfer;
}

function dragColumn(sourceName: string, targetName: string) {
  const sourceHandle = screen.getByRole('button', {
    name: `Drag ${sourceName} to reorder`,
  });
  const targetHandle = screen.getByRole('button', {
    name: `Drag ${targetName} to reorder`,
  });
  const dataTransfer = createDataTransfer();

  fireEvent.dragStart(sourceHandle, { dataTransfer });
  fireEvent.dragOver(targetHandle, { dataTransfer });
  fireEvent.drop(targetHandle, { dataTransfer });
  fireEvent.dragEnd(sourceHandle, { dataTransfer });
}

function columnNamesInOrder(): string[] {
  return screen
    .getAllByLabelText(/^Column name \d+$/)
    .map((input) => (input as HTMLInputElement).value);
}

describe('BoardDesignerWorkspace', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '11111111-1111-4111-8111-111111111111'
    );
  });

  it('adds, renames, maps, reorders, and saves a column with one stable UUID', async () => {
    renderDesigner();
    fireEvent.click(screen.getByRole('button', { name: 'Add column' }));

    const addedName = screen.getByLabelText('Column name 7');
    fireEvent.change(addedName, { target: { value: 'Review queue' } });
    fireEvent.click(
      screen.getByRole('combobox', { name: 'Status for Review queue' })
    );
    fireEvent.click(await screen.findByRole('option', { name: 'InProgress' }));
    dragColumn('Review queue', 'Done');
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(1));
    const savedConfig =
      vi.mocked(updateProject).mock.calls[0]?.[1].workflow_config;
    expect(savedConfig?.columns).toEqual([
      ...customConfig.columns.slice(0, -1),
      {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Review queue',
        status: 'InProgress',
      },
      customConfig.columns.at(-1),
    ]);
    expect(refresh).toHaveBeenCalled();
  });

  it('reorders only columns while preserving transition rules', async () => {
    const transitions = [
      {
        fromColumnId: 'development',
        toColumnId: 'code-review',
        allowAnyOf: [{ scope: 'role' as const, role: 'manager' as const }],
      },
    ];
    const statusTransitions = [
      {
        fromStatus: 'ToDo' as const,
        toStatus: 'InProgress' as const,
        allowAnyOf: [{ scope: 'role' as const, role: 'member' as const }],
      },
    ];
    renderDesigner(true, {
      version: '2',
      columns: customConfig.columns,
      transitions,
      statusTransitions,
    });

    dragColumn('Backlog', 'Done');
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(1));
    expect(vi.mocked(updateProject).mock.calls[0]?.[1].workflow_config).toEqual(
      {
        version: '2',
        columns: [...customConfig.columns.slice(1), customConfig.columns[0]],
        transitions,
        statusTransitions,
      }
    );
  });

  it('does not render the old column movement buttons', () => {
    renderDesigner();

    expect(
      screen.queryAllByRole('button', { name: /^Move .+ (up|down)$/ })
    ).toHaveLength(0);
  });

  it('treats dropping a column on itself as a no-op', () => {
    renderDesigner();

    dragColumn('Code Review', 'Code Review');

    expect(columnNamesInOrder()).toEqual(
      customConfig.columns.map((column) => column.name)
    );
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });

  it('uses the returned lock timestamp and saved baseline for a second save', async () => {
    renderDesigner();
    const name = screen.getByLabelText('Column name 1');

    fireEvent.change(name, { target: { value: 'Incoming' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(1));

    // Wait for isSaving to clear — label is "Saving…" while the mutation settles.
    const saveButton = await screen.findByRole('button', {
      name: 'Save changes',
    });
    expect(saveButton).toBeDisabled();

    fireEvent.change(name, { target: { value: 'Inbox' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(2));

    expect(vi.mocked(updateProject).mock.calls[1]?.[2]).toBe(
      '2026-09-11T01:00:00.000Z'
    );
    expect(
      vi.mocked(updateProject).mock.calls[1]?.[1]?.workflow_config?.columns?.[0]
    ).toEqual({ id: 'backlog', name: 'Inbox', status: 'New' });
  });

  it('deletes a newly added column without a persisted-column warning', () => {
    renderDesigner();
    fireEvent.click(screen.getByRole('button', { name: 'Add column' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete New column' }));

    expect(
      screen.queryByText('Delete saved board column?')
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Column name 7')).not.toBeInTheDocument();
  });

  it('confirms deletion of a persisted column and explains status fallback', () => {
    renderDesigner();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Code Review' }));

    expect(screen.getByText('Delete saved board column?')).toBeInTheDocument();
    expect(
      screen.getByText(/fall back to the first remaining column/i)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete column' }));
    expect(screen.queryByDisplayValue('Code Review')).not.toBeInTheDocument();
  });

  it('blocks saving after the final column for a required status is deleted', () => {
    renderDesigner();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Backlog' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete column' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      screen.getAllByText(/at least one column mapped to New/i).length
    ).toBeGreaterThan(0);
    expect(updateProject).not.toHaveBeenCalled();
  });

  it('keeps controls editable when edit permission is granted', () => {
    renderDesigner(true);
    expect(screen.getByRole('button', { name: 'Add column' })).toBeEnabled();
    expect(screen.getByLabelText('Column name 1')).toBeEnabled();
  });

  it('is read-only for members', () => {
    renderDesigner(false);
    expect(screen.getByText(/view-only access/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add column' })).toBeDisabled();
    expect(screen.getByLabelText('Column name 1')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Movement rules for Code Review' })
    ).toBeDisabled();
    const dragHandle = screen.getByRole('button', {
      name: 'Drag Code Review to reorder',
    });
    expect(dragHandle).toBeDisabled();
    expect(dragHandle).toHaveAttribute('draggable', 'false');

    dragColumn('Code Review', 'Backlog');
    expect(columnNamesInOrder()).toEqual(
      customConfig.columns.map((column) => column.name)
    );
  });

  it('loads and consumes a valid Alice session draft as dirty without saving it', async () => {
    const aliceDraft = {
      ...customConfig,
      columns: customConfig.columns.map((column) =>
        column.id === 'code-review'
          ? { ...column, name: 'Peer Review' }
          : column
      ),
    };
    sessionStorage.setItem('board_draft_proj-1', JSON.stringify(aliceDraft));

    renderDesigner();

    expect(
      await screen.findByText(/Draft generated by Alice/i)
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue('Peer Review')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
    expect(sessionStorage.getItem('board_draft_proj-1')).toBeNull();
    expect(updateProject).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(screen.getByDisplayValue('Code Review')).toBeInTheDocument();
    expect(
      screen.queryByText(/Draft generated by Alice/i)
    ).not.toBeInTheDocument();
  });

  it('ignores and discards an invalid Alice session draft safely', async () => {
    sessionStorage.setItem(
      'board_draft_proj-1',
      JSON.stringify({
        version: '1',
        columns: [{ id: 'new', name: 'New', status: 'New' }],
      })
    );

    renderDesigner();

    await waitFor(() =>
      expect(sessionStorage.getItem('board_draft_proj-1')).toBeNull()
    );
    expect(screen.getByDisplayValue('Code Review')).toBeInTheDocument();
    expect(
      screen.queryByText(/Draft generated by Alice/i)
    ).not.toBeInTheDocument();
    expect(updateProject).not.toHaveBeenCalled();
  });

  it('does not consume a session draft belonging to another project', () => {
    sessionStorage.setItem(
      'board_draft_project-2',
      JSON.stringify({
        ...customConfig,
        columns: customConfig.columns.map((column) =>
          column.id === 'code-review'
            ? { ...column, name: 'Other Project Review' }
            : column
        ),
      })
    );

    renderDesigner();

    expect(screen.getByDisplayValue('Code Review')).toBeInTheDocument();
    expect(
      screen.queryByDisplayValue('Other Project Review')
    ).not.toBeInTheDocument();
    expect(sessionStorage.getItem('board_draft_project-2')).not.toBeNull();
  });

  it('keeps an Alice draft read-only for a member', async () => {
    const aliceDraft = {
      ...customConfig,
      columns: customConfig.columns.map((column) =>
        column.id === 'code-review'
          ? { ...column, name: 'Peer Review' }
          : column
      ),
    };
    sessionStorage.setItem('board_draft_proj-1', JSON.stringify(aliceDraft));

    renderDesigner(false);

    expect(await screen.findByDisplayValue('Peer Review')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    expect(updateProject).not.toHaveBeenCalled();
  });

  it('requires deletion confirmation before saving an Alice draft that omits a persisted column', async () => {
    const aliceDraft = {
      ...customConfig,
      columns: customConfig.columns.filter(
        (column) => column.id !== 'code-review'
      ),
    };
    sessionStorage.setItem('board_draft_proj-1', JSON.stringify(aliceDraft));

    renderDesigner();
    await screen.findByText(/Draft generated by Alice/i);
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      screen.getByText('Save a draft that removes saved columns?')
    ).toBeInTheDocument();
    expect(screen.getByText(/Code Review/)).toBeInTheDocument();
    expect(updateProject).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Save board draft' }));
    await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(1));
    expect(updateProject).toHaveBeenCalledWith(
      'proj-1',
      expect.objectContaining({ workflow_config: aliceDraft }),
      '2026-07-09T10:00:00Z'
    );
  });

  it('creates an OR rule and upgrades a version 1 board to version 2', async () => {
    renderDesigner();
    fireEvent.click(
      screen.getByRole('button', { name: 'Movement rules for Code Review' })
    );

    expect(
      screen.getByText('Movement rules for Code Review')
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Any selected role, team, or person/i)
    ).not.toBeInTheDocument();
    await pickComboboxOption('Source column', 'Development');
    fireEvent.click(screen.getByRole('combobox', { name: 'Access mode' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Restricted' }));

    expect(
      screen.getByText(/Any selected role, team, or person/i)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Manager'));
    fireEvent.click(screen.getByLabelText('QA Team'));
    fireEvent.click(screen.getByLabelText(/Alice Reviewer/));
    fireEvent.click(
      screen.getByRole('button', { name: 'Apply movement rule' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(1));
    expect(vi.mocked(updateProject).mock.calls[0]?.[1].workflow_config).toEqual(
      {
        version: '2',
        columns: customConfig.columns,
        transitions: [
          {
            fromColumnId: 'development',
            toColumnId: 'code-review',
            allowAnyOf: [
              { scope: 'role', role: 'manager' },
              { scope: 'team', teamId: TEAM_ID },
              { scope: 'user', userId: USER_ID },
            ],
          },
        ],
      }
    );
  });

  it('preserves status transition rules when editing a board movement rule', async () => {
    const statusTransitions = [
      {
        fromStatus: 'ToDo' as const,
        toStatus: 'InProgress' as const,
        allowAnyOf: [{ scope: 'role' as const, role: 'member' as const }],
      },
    ];
    const boardDraft = {
      version: '2' as const,
      columns: customConfig.columns,
      transitions: [
        {
          fromColumnId: 'development',
          toColumnId: 'code-review',
          allowAnyOf: [{ scope: 'role' as const, role: 'manager' as const }],
        },
      ],
      statusTransitions,
    };
    sessionStorage.setItem('board_draft_proj-1', JSON.stringify(boardDraft));
    renderDesigner();

    expect(
      await screen.findByText(/Draft generated by Alice/i)
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Movement rules for Code Review' })
    );
    await pickComboboxOption('Source column', 'Development');
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: 'Access mode' })
      ).toHaveTextContent('Restricted')
    );
    fireEvent.click(screen.getByLabelText('QA Team'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Apply movement rule' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(1));
    expect(vi.mocked(updateProject).mock.calls[0]?.[1].workflow_config).toEqual(
      {
        version: '2',
        columns: customConfig.columns,
        transitions: [
          {
            fromColumnId: 'development',
            toColumnId: 'code-review',
            allowAnyOf: [
              { scope: 'role', role: 'manager' },
              { scope: 'team', teamId: TEAM_ID },
            ],
          },
        ],
        statusTransitions,
      }
    );
  });

  it('uses Everyone mode to remove an existing transition rule', async () => {
    renderDesigner(true, {
      version: '2',
      columns: customConfig.columns,
      transitions: [
        {
          fromColumnId: 'development',
          toColumnId: 'code-review',
          allowAnyOf: [{ scope: 'role', role: 'manager' }],
        },
      ],
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Movement rules for Code Review' })
    );
    await pickComboboxOption('Source column', 'Development');
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: 'Access mode' })
      ).toHaveTextContent('Restricted')
    );
    fireEvent.click(screen.getByRole('combobox', { name: 'Access mode' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Everyone' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Apply movement rule' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(1));
    expect(
      vi.mocked(updateProject).mock.calls[0]?.[1].workflow_config
    ).toMatchObject({ version: '2', transitions: [] });
  });

  it('warns about a stale reference and removes it when the rule is repaired', async () => {
    const staleUserId = '5be58df2-22c8-45e5-b618-7b0bdbbf72bc';
    renderDesigner(true, {
      version: '2',
      columns: customConfig.columns,
      transitions: [
        {
          fromColumnId: 'development',
          toColumnId: 'code-review',
          allowAnyOf: [
            { scope: 'role', role: 'manager' },
            { scope: 'user', userId: staleUserId },
          ],
        },
      ],
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Movement rules for Code Review' })
    );
    await pickComboboxOption('Source column', 'Development');

    expect(
      await screen.findByText(
        /saved team or user reference is no longer active/i
      )
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Apply movement rule' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(1));
    expect(vi.mocked(updateProject).mock.calls[0]?.[1].workflow_config).toEqual(
      {
        version: '2',
        columns: customConfig.columns,
        transitions: [
          {
            fromColumnId: 'development',
            toColumnId: 'code-review',
            allowAnyOf: [{ scope: 'role', role: 'manager' }],
          },
        ],
      }
    );
  });

  it('adds a status transition with OR permissions and upgrades version 1 to version 2', async () => {
    renderDesigner(true, {
      ...customConfig,
      work_item_types: ['Epic', 'Story', 'Task'],
      hierarchy: { Epic: null, Story: 'Epic', Task: 'Story' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Add status transition rule' })
    );

    await pickSelectValue('Source status', 'To Do');
    await pickSelectValue('Source status', 'Draft');
    expect(
      screen.getByRole('combobox', { name: 'Source status' })
    ).toHaveTextContent('Draft');
    await pickSelectValue('Source status', 'To Do');
    await pickSelectValue('Destination status', 'In Progress');
    fireEvent.click(screen.getByLabelText('Manager'));
    fireEvent.click(screen.getByLabelText('QA Team'));
    fireEvent.click(screen.getByLabelText(/Alice Reviewer/));
    fireEvent.click(
      screen.getByRole('button', { name: 'Apply status transition rule' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(1));
    expect(vi.mocked(updateProject).mock.calls[0]?.[1].workflow_config).toEqual(
      {
        work_item_types: ['Epic', 'Story', 'Task'],
        hierarchy: { Epic: null, Story: 'Epic', Task: 'Story' },
        version: '2',
        columns: customConfig.columns,
        transitions: [],
        statusTransitions: [
          {
            fromStatus: 'ToDo',
            toStatus: 'InProgress',
            allowAnyOf: [
              { scope: 'role', role: 'manager' },
              { scope: 'team', teamId: TEAM_ID },
              { scope: 'user', userId: USER_ID },
            ],
          },
        ],
      }
    );
  });

  it('edits a status transition while preserving board movement rules', async () => {
    const transitions = [
      {
        fromColumnId: 'development',
        toColumnId: 'code-review',
        allowAnyOf: [{ scope: 'role' as const, role: 'manager' as const }],
      },
    ];
    renderDesigner(true, {
      version: '2',
      columns: customConfig.columns,
      transitions,
      statusTransitions: [
        {
          fromStatus: 'ToDo',
          toStatus: 'InProgress',
          allowAnyOf: [{ scope: 'role', role: 'member' }],
        },
      ],
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Edit status transition To Do to In Progress',
      })
    );
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: 'Access mode' })
      ).toHaveTextContent('Restricted')
    );
    await pickSelectValue('Destination status', 'Testing');
    fireEvent.click(screen.getByLabelText('QA Team'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Apply status transition rule' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(1));
    expect(vi.mocked(updateProject).mock.calls[0]?.[1].workflow_config).toEqual(
      {
        version: '2',
        columns: customConfig.columns,
        transitions,
        statusTransitions: [
          {
            fromStatus: 'ToDo',
            toStatus: 'Testing',
            allowAnyOf: [
              { scope: 'role', role: 'member' },
              { scope: 'team', teamId: TEAM_ID },
            ],
          },
        ],
      }
    );
  });

  it('removes a status transition rule', async () => {
    const transitions = [
      {
        fromColumnId: 'development',
        toColumnId: 'code-review',
        allowAnyOf: [{ scope: 'role' as const, role: 'manager' as const }],
      },
    ];
    renderDesigner(true, {
      version: '2',
      columns: customConfig.columns,
      transitions,
      statusTransitions: [
        {
          fromStatus: 'Testing',
          toStatus: 'Done',
          allowAnyOf: [{ scope: 'role', role: 'manager' }],
        },
      ],
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Remove status transition Testing to Done',
      })
    );
    expect(
      screen.getByText('No status transition rules are configured.')
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(1));
    expect(
      vi.mocked(updateProject).mock.calls[0]?.[1].workflow_config
    ).toMatchObject({
      version: '2',
      transitions,
      statusTransitions: [],
    });
  });

  it('prevents selecting the same source and destination status', async () => {
    renderDesigner();
    fireEvent.click(
      screen.getByRole('button', { name: 'Add status transition rule' })
    );

    const destination = screen.getByRole('combobox', {
      name: 'Destination status',
    });
    fireEvent.click(destination);
    const draftOption = await screen.findByRole('option', { name: 'Draft' });
    expect(draftOption).toHaveAttribute('data-disabled');
    fireEvent.click(draftOption);
    expect(destination).toHaveTextContent('New');
  });

  it('prevents selecting a duplicate status transition pair', async () => {
    renderDesigner(true, {
      version: '2',
      columns: customConfig.columns,
      transitions: [],
      statusTransitions: [
        {
          fromStatus: 'ToDo',
          toStatus: 'InProgress',
          allowAnyOf: [{ scope: 'role', role: 'manager' }],
        },
      ],
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Add status transition rule' })
    );
    await pickSelectValue('Source status', 'To Do');

    const destination = screen.getByRole('combobox', {
      name: 'Destination status',
    });
    fireEvent.click(destination);
    const duplicateOption = await screen.findByRole('option', {
      name: 'In Progress',
    });
    expect(duplicateOption).toHaveAttribute('data-disabled');
    fireEvent.click(duplicateOption);
    expect(destination).toHaveTextContent('New');
  });

  it('resets a custom board by saving workflow_config null', async () => {
    renderDesigner();
    fireEvent.click(
      screen.getByRole('button', { name: 'Reset to default board' })
    );
    expect(screen.getByText('Reset to the default board?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reset board' }));

    await waitFor(() =>
      expect(updateProject).toHaveBeenCalledWith(
        'proj-1',
        { workflow_config: null },
        '2026-07-09T10:00:00Z'
      )
    );
  });

  it('starts from defaults without saving and disables reset for a default board', () => {
    renderDesigner(true, null);
    expect(screen.getByDisplayValue('New')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Reset to default board' })
    ).toBeDisabled();
    expect(updateProject).not.toHaveBeenCalled();
  });

  it('falls back safely and can replace an invalid persisted configuration', async () => {
    renderDesigner(true, {
      version: '1',
      columns: [{ id: 'only-new', name: 'Only New', status: 'New' }],
    });
    expect(
      screen.getByText(/saved board configuration is invalid/i)
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue('To Do')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Reset to default board' })
    ).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(1));
    expect(
      vi.mocked(updateProject).mock.calls[0]?.[1].workflow_config?.columns
    ).toHaveLength(5);
  });
});
