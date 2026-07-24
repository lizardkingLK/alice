import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WorkItemForm } from '@/app/work-items/_components/workItem-form';
import {
  createWorkItem,
  updateWorkItem,
} from '@/app/work-items/_services/workItem.service.client';
import { userFactory } from '../factories/user.factory';
import { projectFactory } from '../factories/project.factory';
import { workItemFactory } from '../factories/workItem.factory';

vi.mock('@/app/work-items/_services/workItem.service.client', () => ({
  createWorkItem: vi.fn(),
  updateWorkItem: vi.fn(),
}));

vi.mock('@/app/_shared/utility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/_shared/utility')>();
  return {
    ...actual,
    delay: vi.fn(() => Promise.resolve()),
  };
});

describe('WorkItemForm', () => {
  const projects = projectFactory.buildList(2);
  const projectMembers = userFactory.buildList(2);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders fields and lists projects and members in selects', () => {
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
    expect(screen.getByLabelText(/Due date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Assign to/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Story points/i)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/^Project$/i));
    expect(
      screen.getByRole('option', { name: projects[0]!.name })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: projects[1]!.name })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Assign to/i));
    expect(
      screen.getByRole('option', {
        name: `${projectMembers[0]!.name} (${projectMembers[0]!.email})`,
      })
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
    fireEvent.click(screen.getByLabelText(/^Project$/i));
    fireEvent.click(screen.getByRole('option', { name: projects[0]!.name }));
    fireEvent.click(screen.getByLabelText(/^Type$/i));
    fireEvent.click(screen.getByRole('option', { name: 'Task' }));
    fireEvent.change(screen.getByLabelText(/Due date/i), {
      target: { value: '2026-08-01' },
    });
    fireEvent.click(screen.getByLabelText(/Assign to/i));
    fireEvent.click(
      screen.getByRole('option', {
        name: `${projectMembers[0]!.name} (${projectMembers[0]!.email})`,
      })
    );
    fireEvent.change(screen.getByLabelText(/Story points/i), {
      target: { value: '8' },
    });

    fireEvent.submit(screen.getByLabelText(/^Title$/i).closest('form')!);

    // Assert
    await waitFor(() => {
      expect(createWorkItem).toHaveBeenCalledTimes(1);
    });

    const formData = vi.mocked(createWorkItem).mock.calls[0]![0] as FormData;
    expect(formData.get('title')).toBe('New backlog item');
    expect(formData.get('project_id')).toBe(projects[0]!.id);
    expect(formData.get('type')).toBe('Task');
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
    fireEvent.submit(screen.getByLabelText(/^Title$/i).closest('form')!);

    // Assert
    await waitFor(() => {
      expect(updateWorkItem).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(updateWorkItem).mock.calls[0]![0]).toBe('wi-edit');

    const formData = vi.mocked(updateWorkItem).mock.calls[0]![1] as FormData;
    expect(formData.get('title')).toBe('Updated title');
    expect(formData.get('story_points')).toBe('13');

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
});
