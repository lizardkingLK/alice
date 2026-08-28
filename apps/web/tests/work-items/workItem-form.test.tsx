import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WorkItemForm } from '@/app/work-items/_components/work-item-form/work-item-form';
import {
  createWorkItem,
  updateWorkItem,
} from '@/app/work-items/_services/work-items.mutations.client';
import { userFactory } from '../factories/user.factory';
import { projectFactory } from '../factories/project.factory';
import { workItemFactory } from '../factories/workItem.factory';
import { pickComboboxOption } from '../helpers/pick-combobox-option';
import { fetchProjectMembersForForm } from '@/lib/form-read-actions';

vi.mock('@/app/work-items/_services/work-items.mutations.client', () => ({
  createWorkItem: vi.fn(),
  updateWorkItem: vi.fn(),
  listParentCandidateWorkItems: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/form-read-actions', () => ({
  fetchProjectMembersForForm: vi.fn(),
}));

vi.mock('@/app/_shared/utility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/_shared/utility')>();
  return {
    ...actual,
    delay: vi.fn(() => Promise.resolve()),
  };
});

vi.mock(
  '@repo/ui/components/ui/dropdown-menu',
  () => import('../mocks/dropdown-menu')
);

describe('WorkItemForm', () => {
  const projectMembers = userFactory.buildList(2);
  const projects = projectFactory.buildList(2).map((proj, idx) => ({
    ...proj,
    owner: {
      id: projectMembers[idx]!.id,
      name: projectMembers[idx]!.name,
      email: projectMembers[idx]!.email,
    },
  }));

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchProjectMembersForForm).mockResolvedValue(
      projectMembers.map((member) => ({
        id: member.id,
        name: member.name,
        email: member.email,
        profile_picture: member.profile_picture ?? null,
      }))
    );
  });

  it('renders fields and lists projects and members in selects', async () => {
    // Arrange
    render(
      <WorkItemForm
        projects={projects}
        projectMembers={projectMembers}
        onSuccess={vi.fn()}
      />
    );

    // Assert
    expect(screen.getByLabelText(/^Title$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Project$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Type$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Priority/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Due date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Assign to/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Priority$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Story points/i)).toBeInTheDocument();

    await pickComboboxOption(/^Project$/i, projects[0]!.name);
    expect(screen.getByRole('combobox', { name: /^Project$/i })).toHaveValue(
      projects[0]!.name
    );

    await pickComboboxOption(
      /Assign to/i,
      `${projectMembers[0]!.name} (${projectMembers[0]!.email})`
    );
    expect(screen.getByRole('combobox', { name: /Assign to/i })).toHaveValue(
      `${projectMembers[0]!.name} (${projectMembers[0]!.email})`
    );
  });

  it('renders modern create fields when createFormMode is modern', () => {
    render(
      <WorkItemForm
        projects={projects}
        projectMembers={projectMembers}
        onSuccess={vi.fn()}
        createFormMode="modern"
      />
    );

    expect(screen.getByLabelText(/^Title$/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/^Title$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Description$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Project$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Type$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Assignee$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Priority$/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^More fields$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Labels$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Due date$/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^Create$/i })
    ).toBeInTheDocument();
  });

  it('adds optional modern fields one at a time from More menu', () => {
    render(
      <WorkItemForm
        projects={projects}
        projectMembers={projectMembers}
        onSuccess={vi.fn()}
        createFormMode="modern"
      />
    );

    expect(screen.queryByLabelText(/^Priority$/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: /^Priority$/i })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: /^Priority$/i }));

    expect(screen.getByLabelText(/^Priority$/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: /^Priority$/i })
    ).not.toBeInTheDocument();
  });

  it('pre-fills and locks due date in modern create when defaultDueDate is set', () => {
    render(
      <WorkItemForm
        projects={projects}
        projectMembers={projectMembers}
        onSuccess={vi.fn()}
        createFormMode="modern"
        defaultDueDate="2026-08-27"
        lockDueDate
      />
    );

    const dueDateInput = screen.getByLabelText(/^Due date$/i);
    expect(dueDateInput).toBeInTheDocument();
    expect(dueDateInput).toHaveValue('2026-08-27');
    expect(dueDateInput).toBeDisabled();
    expect(
      screen.queryByRole('menuitem', { name: /^Due date$/i })
    ).not.toBeInTheDocument();
  });

  it('uses modern fields in edit mode when createFormMode is modern', () => {
    const itemToEdit = workItemFactory.build({
      title: 'Existing item',
      project_id: projects[0]!.id,
      type: 'Task',
      assignee_id: projectMembers[0]!.id,
    });

    render(
      <WorkItemForm
        projects={projects}
        projectMembers={projectMembers}
        itemToEdit={itemToEdit}
        onSuccess={vi.fn()}
        createFormMode="modern"
      />
    );

    expect(screen.getByLabelText(/^Title$/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/^Title$/i)).toHaveValue(
      'Existing item'
    );
    expect(screen.getByLabelText(/^Description$/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^Save Changes$/i })
    ).toBeInTheDocument();
  });

  it('submits in create mode and calls onSuccess', async () => {
    // Arrange
    const onSuccess = vi.fn();
    const created = workItemFactory.build({ title: 'New backlog item' });
    vi.mocked(createWorkItem).mockResolvedValue({
      data: created,
      error: null,
    });

    render(
      <WorkItemForm
        projects={projects}
        projectMembers={projectMembers}
        onSuccess={onSuccess}
        onClose={vi.fn()}
      />
    );

    // Act
    fireEvent.change(screen.getByLabelText(/^Title$/i), {
      target: { value: 'New backlog item' },
    });
    await pickComboboxOption(/^Project$/i, projects[0]!.name);
    fireEvent.click(screen.getByLabelText(/^Type$/i));
    fireEvent.click(screen.getByRole('option', { name: 'Task' }));
    fireEvent.change(screen.getByLabelText(/Due date/i), {
      target: { value: '2026-08-01' },
    });
    await pickComboboxOption(
      /Assign to/i,
      `${projectMembers[0]!.name} (${projectMembers[0]!.email})`
    );
    fireEvent.change(screen.getByLabelText(/Story points/i), {
      target: { value: '8' },
    });

    fireEvent.click(screen.getByLabelText(/^Priority$/i));
    fireEvent.click(screen.getByRole('option', { name: 'High' }));

    fireEvent.submit(screen.getByLabelText(/^Title$/i).closest('form')!);

    // Assert
    await waitFor(() => {
      expect(createWorkItem).toHaveBeenCalledTimes(1);
    });

    const formData = vi.mocked(createWorkItem).mock.calls[0]![0] as FormData;
    expect(formData.get('title')).toBe('New backlog item');
    expect(formData.get('project_id')).toBe(projects[0]!.id);
    expect(formData.get('type')).toBe('Task');
    expect(formData.get('priority')).toBe('high');
    expect(formData.get('due_date')).toBe('2026-08-01');
    expect(formData.get('assignee_id')).toBe(projectMembers[0]!.id);
    expect(formData.get('story_points')).toBe('8');

    expect(
      await screen.findByText(/Work item created successfully/i)
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(created);
    });
  });

  it('populates fields and submits update in edit mode', async () => {
    // Arrange
    const onSuccess = vi.fn();
    const itemToEdit = workItemFactory.build({
      id: 'wi-edit',
      title: 'Original title',
      project_id: projects[0]!.id,
      type: 'Story',
      due_date: '2026-07-20',
      assignee_id: projectMembers[0]!.id,
      story_points: 5,
    });
    const updated = workItemFactory.build({
      ...itemToEdit,
      title: 'Updated title',
    });
    vi.mocked(updateWorkItem).mockResolvedValue({
      data: updated,
      error: null,
    });

    render(
      <WorkItemForm
        projects={projects}
        projectMembers={projectMembers}
        itemToEdit={itemToEdit}
        onSuccess={onSuccess}
      />
    );

    // Assert — populated
    expect(screen.getByLabelText(/^Title$/i)).toHaveValue('Original title');
    expect(screen.getByLabelText(/Priority/i)).toHaveTextContent('Medium');
    expect(screen.getByLabelText(/Due date/i)).toHaveValue('2026-07-20');
    expect(screen.getByLabelText(/Story points/i)).toHaveValue(5);
    expect(
      screen.getByRole('button', { name: /Save Changes/i })
    ).toBeInTheDocument();

    // Act
    fireEvent.change(screen.getByLabelText(/^Title$/i), {
      target: { value: 'Updated title' },
    });
    fireEvent.change(screen.getByLabelText(/Story points/i), {
      target: { value: '13' },
    });
    fireEvent.click(screen.getByLabelText(/^Priority$/i));
    fireEvent.click(screen.getByRole('option', { name: 'High' }));
    fireEvent.submit(screen.getByLabelText(/^Title$/i).closest('form')!);

    // Assert
    await waitFor(() => {
      expect(updateWorkItem).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(updateWorkItem).mock.calls[0]![0]).toBe('wi-edit');

    const formData = vi.mocked(updateWorkItem).mock.calls[0]![1] as FormData;
    expect(formData.get('title')).toBe('Updated title');
    expect(formData.get('story_points')).toBe('13');
    expect(formData.get('priority')).toBe('high');
    expect(vi.mocked(updateWorkItem).mock.calls[0]![2]).toBe(
      itemToEdit.updated_at
    );

    expect(
      await screen.findByText(/Work item updated successfully/i)
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(updated);
    });
  });

  it('shows error message when the service rejects', async () => {
    // Arrange
    const onSuccess = vi.fn();
    vi.mocked(createWorkItem).mockRejectedValue(new Error('Network failed'));

    render(
      <WorkItemForm
        projects={projects}
        projectMembers={projectMembers}
        onSuccess={onSuccess}
      />
    );

    // Act
    fireEvent.change(screen.getByLabelText(/^Title$/i), {
      target: { value: 'Will fail' },
    });
    fireEvent.submit(screen.getByLabelText(/^Title$/i).closest('form')!);

    // Assert
    expect(await screen.findByText(/Network failed/i)).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('calls onClose when Cancel is clicked', () => {
    // Arrange
    const onClose = vi.fn();
    render(
      <WorkItemForm
        projects={projects}
        projectMembers={projectMembers}
        onSuccess={vi.fn()}
        onClose={onClose}
      />
    );

    // Act
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

    // Assert
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows create vs edit submit labels', () => {
    // Arrange / Act — create
    const { unmount } = render(
      <WorkItemForm
        projects={projects}
        projectMembers={projectMembers}
        onSuccess={vi.fn()}
      />
    );

    // Assert
    expect(
      screen.getByRole('button', { name: /Create Work Item/i })
    ).toBeInTheDocument();
    unmount();

    // Arrange / Act — edit
    render(
      <WorkItemForm
        projects={projects}
        projectMembers={projectMembers}
        itemToEdit={workItemFactory.build()}
        onSuccess={vi.fn()}
      />
    );

    // Assert
    expect(
      screen.getByRole('button', { name: /Save Changes/i })
    ).toBeInTheDocument();
  });

  it('locks type and submits parent_id for subtask create', async () => {
    // Arrange
    const onSuccess = vi.fn();
    const parentId = 'parent-story-1';
    const created = workItemFactory.build({
      title: 'Child task',
      type: 'Task',
      parent_id: parentId,
      project_id: projects[0]!.id,
    });
    vi.mocked(createWorkItem).mockResolvedValue({
      data: created,
      error: null,
    });

    render(
      <WorkItemForm
        projects={[projects[0]!]}
        projectMembers={projectMembers}
        parentId={parentId}
        allowedTypes={['Task']}
        lockProject
        lockType
        lockParent
        onSuccess={onSuccess}
        onClose={vi.fn()}
      />
    );

    // Assert — type locked to Task
    expect(screen.getByLabelText(/^Type$/i)).toBeDisabled();
    expect(screen.getByLabelText(/^Project$/i)).toBeDisabled();

    // Act
    fireEvent.change(screen.getByLabelText(/^Title$/i), {
      target: { value: 'Child task' },
    });
    await pickComboboxOption(
      /Assign to/i,
      `${projectMembers[0]!.name} (${projectMembers[0]!.email})`
    );
    fireEvent.submit(screen.getByLabelText(/^Title$/i).closest('form')!);

    // Assert
    await waitFor(() => {
      expect(createWorkItem).toHaveBeenCalledTimes(1);
    });

    const formData = vi.mocked(createWorkItem).mock.calls[0]![0] as FormData;
    expect(formData.get('parent_id')).toBe(parentId);
    expect(formData.get('type')).toBe('Task');
    expect(formData.get('project_id')).toBe(projects[0]!.id);
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(created);
    });
  });

  it('restricts type options to allowedTypes', () => {
    // Arrange — two allowed types so the select stays interactive
    render(
      <WorkItemForm
        projects={projects}
        projectMembers={projectMembers}
        allowedTypes={['Story', 'Task']}
        onSuccess={vi.fn()}
      />
    );

    // Act
    fireEvent.click(screen.getByLabelText(/^Type$/i));

    // Assert
    expect(screen.getByRole('option', { name: 'Story' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Task' })).toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: 'Epic' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: 'Issue' })
    ).not.toBeInTheDocument();
  });
});
