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

describe('BoardDesignerWorkspace', () => {
  beforeEach(() => {
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
    fireEvent.click(
      screen.getByRole('button', { name: 'Move Review queue up' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(1));
    const savedConfig =
      vi.mocked(updateProject).mock.calls[0]?.[1].workflow_config;
    expect(savedConfig).toEqual(
      expect.objectContaining({
        columns: expect.arrayContaining([
          {
            id: '11111111-1111-4111-8111-111111111111',
            name: 'Review queue',
            status: 'InProgress',
          },
        ]),
      })
    );
    expect(savedConfig?.columns.at(-2)?.id).toBe(
      '11111111-1111-4111-8111-111111111111'
    );
    expect(refresh).toHaveBeenCalled();
  });

  it('uses the returned lock timestamp and saved baseline for a second save', async () => {
    renderDesigner();
    const name = screen.getByLabelText('Column name 1');

    fireEvent.change(name, { target: { value: 'Incoming' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(1));

    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    fireEvent.change(name, { target: { value: 'Inbox' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(updateProject).toHaveBeenCalledTimes(2));

    expect(vi.mocked(updateProject).mock.calls[1]?.[2]).toBe(
      '2026-09-11T01:00:00.000Z'
    );
    expect(
      vi.mocked(updateProject).mock.calls[1]?.[1].workflow_config?.columns[0]
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
