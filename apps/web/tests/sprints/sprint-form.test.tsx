import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SprintForm } from '@/app/sprints/_components/sprint-form';
import {
  createSprint,
  updateSprint,
} from '@/app/sprints/_services/sprints.service';
import type { Project } from '@/app/projects/_services/projects.service.base';

vi.mock('@/app/sprints/_services/sprints.service', () => ({
  createSprint: vi.fn(),
  updateSprint: vi.fn(),
}));

const mockProjects: Project[] = [
  {
    id: 'proj-1',
    name: 'Project Alpha',
    key: 'PAL',
    description: null,
    owner_id: 'user-1',
    status: 'active',
    start_date: null,
    end_date: null,
    created_at: '2026-07-09T10:00:00Z',
    updated_at: '2026-07-09T10:00:00Z',
    created_by: null,
    updated_by: null,
    deleted_at: null,
    attributes_config: null,
    workflow_config: null,
  },
  {
    id: 'proj-2',
    name: 'Project Beta',
    key: 'PBE',
    description: null,
    owner_id: 'user-1',
    status: 'active',
    start_date: null,
    end_date: null,
    created_at: '2026-07-09T10:00:00Z',
    updated_at: '2026-07-09T10:00:00Z',
    created_by: null,
    updated_by: null,
    deleted_at: null,
    attributes_config: null,
    workflow_config: null,
  },
  {
    id: 'proj-inactive',
    name: 'Inactive Project',
    key: 'INAC',
    description: null,
    owner_id: 'user-1',
    status: 'archived',
    start_date: null,
    end_date: null,
    created_at: '2026-07-09T10:00:00Z',
    updated_at: '2026-07-09T10:00:00Z',
    created_by: null,
    updated_by: null,
    deleted_at: null,
    attributes_config: null,
    workflow_config: null,
  },
  {
    id: 'proj-deleted',
    name: 'Deleted Project',
    key: 'DEL',
    description: null,
    owner_id: 'user-1',
    status: 'active',
    start_date: null,
    end_date: null,
    created_at: '2026-07-09T10:00:00Z',
    updated_at: '2026-07-09T10:00:00Z',
    created_by: null,
    updated_by: null,
    deleted_at: '2026-07-09T00:00:00Z',
    attributes_config: null,
    workflow_config: null,
  },
];

const mockSprint = {
  id: 'sprint-123',
  name: 'Sprint 1',
  goal: 'Achieve project milestone',
  status: 'Not Started' as const,
  startDate: '2026-07-10',
  endDate: '2026-07-24',
  createdBy: 'user-1',
  createdAt: '2026-07-09T10:00:00Z',
  updatedAt: '2026-07-09T10:00:00Z',
  project: {
    id: 'proj-1',
    name: 'Project Alpha',
    key: 'PAL',
  },
};

describe('SprintForm Component', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders projects in dropdown sorted and filtered', () => {
    render(<SprintForm projects={mockProjects} />);

    const projectSelect = screen.getByLabelText(/Project/i);
    expect(projectSelect).toBeInTheDocument();

    const options = screen
      .getAllByRole('option', { hidden: true })
      .filter((opt) => (opt as HTMLOptionElement).value !== '');
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent('Project Alpha (PAL)');
    expect(options[1]).toHaveTextContent('Project Beta (PBE)');
  });

  it('performs validation on submit', async () => {
    render(<SprintForm projects={mockProjects} />);

    fireEvent.change(screen.getByLabelText(/Sprint name/i), {
      target: { value: 'Sprint 1' },
    });
    fireEvent.change(screen.getByLabelText(/Start date/i), {
      target: { value: '2026-07-20' },
    });
    fireEvent.change(screen.getByLabelText(/End date/i), {
      target: { value: '2026-07-10' },
    });

    const form = screen.getByLabelText(/Sprint name/i).closest('form')!;
    fireEvent.submit(form);

    expect(
      await screen.findByText(/End date must be on or after the start date/i)
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Sprint name/i), {
      target: { value: '   ' },
    });
    fireEvent.submit(form);

    expect(
      await screen.findByText(/Name, start date, and end date are required/i)
    ).toBeInTheDocument();
  });

  it('submits correctly in create mode and fires callbacks', async () => {
    const onSprintUpdated = vi.fn();
    const onSuccess = vi.fn();

    vi.mocked(createSprint).mockResolvedValue(mockSprint);

    render(
      <SprintForm
        projects={mockProjects}
        onSprintUpdated={onSprintUpdated}
        onSuccess={onSuccess}
      />
    );

    fireEvent.change(screen.getByLabelText(/Sprint name/i), {
      target: { value: 'Sprint 1' },
    });
    fireEvent.change(screen.getByLabelText(/Goal/i), {
      target: { value: 'Achieve project milestone' },
    });

    fireEvent.click(screen.getByLabelText(/Project/i));
    fireEvent.click(
      await screen.findByRole('option', { name: 'Project Alpha (PAL)' })
    );

    fireEvent.change(screen.getByLabelText(/Start date/i), {
      target: { value: '2026-07-10' },
    });
    fireEvent.change(screen.getByLabelText(/End date/i), {
      target: { value: '2026-07-24' },
    });

    const form = screen.getByLabelText(/Sprint name/i).closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(createSprint).toHaveBeenCalledWith({
        name: 'Sprint 1',
        goal: 'Achieve project milestone',
        projectId: 'proj-1',
        startDate: '2026-07-10',
        endDate: '2026-07-24',
      });
    });

    expect(
      await screen.findByText(/Sprint "Sprint 1" created/i)
    ).toBeInTheDocument();
    expect(onSprintUpdated).toHaveBeenCalledWith(mockSprint);

    await waitFor(() => expect(onSuccess).toHaveBeenCalled(), {
      timeout: 2000,
    });
  }, 10000);

  it('populates fields from sprintToEdit and updates correctly in edit mode', async () => {
    const onSprintUpdated = vi.fn();
    vi.mocked(updateSprint).mockResolvedValue({
      ...mockSprint,
      name: 'Sprint 1 Updated',
    });

    render(
      <SprintForm
        projects={mockProjects}
        sprintToEdit={mockSprint}
        onSprintUpdated={onSprintUpdated}
      />
    );

    expect(screen.getByLabelText(/Sprint name/i)).toHaveValue('Sprint 1');
    expect(screen.getByLabelText(/Goal/i)).toHaveValue(
      'Achieve project milestone'
    );
    expect(screen.getByLabelText(/Start date/i)).toHaveValue('2026-07-10');
    expect(screen.getByLabelText(/End date/i)).toHaveValue('2026-07-24');

    fireEvent.change(screen.getByLabelText(/Sprint name/i), {
      target: { value: 'Sprint 1 Updated' },
    });

    const form = screen.getByLabelText(/Sprint name/i).closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(updateSprint).toHaveBeenCalledWith('sprint-123', {
        name: 'Sprint 1 Updated',
        goal: 'Achieve project milestone',
        projectId: 'proj-1',
        startDate: '2026-07-10',
        endDate: '2026-07-24',
      });
    });

    expect(
      screen.queryByText(/Sprint "Sprint 1" updated/i)
    ).not.toBeInTheDocument();
    expect(
      await screen.findByText(/Sprint "Sprint 1 Updated" updated/i)
    ).toBeInTheDocument();
    expect(onSprintUpdated).toHaveBeenCalledWith({
      ...mockSprint,
      name: 'Sprint 1 Updated',
    });
  });

  it('triggers onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<SprintForm projects={mockProjects} onClose={onClose} />);

    const closeBtn = screen.getByRole('button', { name: /Close modal/i });
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalled();
  });
});
