import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SprintForm } from '@/app/sprints/_components/sprint-form';
import { createSprint, getSprint, updateSprint } from '@/app/sprints/_services/sprints.service';
import { apiFetch } from '@/lib/api/api-client';

vi.mock('@/app/sprints/_services/sprints.service', () => ({
  createSprint: vi.fn(),
  getSprint: vi.fn(),
  updateSprint: vi.fn(),
}));

vi.mock('@/lib/api/api-client', () => ({
  apiFetch: vi.fn(),
}));

const mockProjects = [
  { id: 'proj-1', name: 'Project Alpha', key: 'PAL', status: 'active', deleted_at: null },
  { id: 'proj-2', name: 'Project Beta', key: 'PBE', status: 'active', deleted_at: null },
  { id: 'proj-inactive', name: 'Inactive Project', key: 'INAC', status: 'inactive', deleted_at: null },
  { id: 'proj-deleted', name: 'Deleted Project', key: 'DEL', status: 'active', deleted_at: '2026-07-09T00:00:00Z' },
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
  beforeEach(() => {
    vi.mocked(apiFetch).mockResolvedValue({ projects: mockProjects });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders projects in dropdown sorted and filtered', async () => {
    render(<SprintForm />);

    // Loader should show initially
    expect(screen.getByText(/Loading projects.../i)).toBeInTheDocument();

    // After resolution, verify select options
    await waitFor(() => {
      expect(screen.queryByText(/Loading projects.../i)).not.toBeInTheDocument();
    });

    const projectSelect = screen.getByLabelText(/Project/i);
    expect(projectSelect).toBeInTheDocument();

    const options = screen.getAllByRole('option');
    // active projects should be Project Alpha, Project Beta.
    // Inactive and deleted should be filtered.
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent('Project Alpha (PAL)');
    expect(options[1]).toHaveTextContent('Project Beta (PBE)');
  });

  it('performs validation on submit', async () => {
    render(<SprintForm />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading projects.../i)).not.toBeInTheDocument();
    });

    // Populate with invalid dates (endDate < startDate)
    fireEvent.change(screen.getByLabelText(/Sprint name/i), { target: { value: 'Sprint 1' } });
    fireEvent.change(screen.getByLabelText(/Start date/i), { target: { value: '2026-07-20' } });
    fireEvent.change(screen.getByLabelText(/End date/i), { target: { value: '2026-07-10' } }); // earlier than start

    const form = screen.getByLabelText(/Sprint name/i).closest('form')!;
    fireEvent.submit(form);

    expect(await screen.findByText(/End date must be on or after the start date/i)).toBeInTheDocument();

    // Clear name to test required validation
    fireEvent.change(screen.getByLabelText(/Sprint name/i), { target: { value: '   ' } });
    fireEvent.submit(form);

    expect(await screen.findByText(/Name, start date, and end date are required/i)).toBeInTheDocument();
  });

  it('submits correctly in create mode and fires callbacks', async () => {
    const onSprintUpdated = vi.fn();
    const onSuccess = vi.fn();

    vi.mocked(createSprint).mockResolvedValue(mockSprint);

    render(<SprintForm onSprintUpdated={onSprintUpdated} onSuccess={onSuccess} />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading projects.../i)).not.toBeInTheDocument();
    });

    // Populate fields
    fireEvent.change(screen.getByLabelText(/Sprint name/i), { target: { value: 'Sprint 1' } });
    fireEvent.change(screen.getByLabelText(/Goal/i), { target: { value: 'Achieve project milestone' } });
    fireEvent.change(screen.getByLabelText(/Start date/i), { target: { value: '2026-07-10' } });
    fireEvent.change(screen.getByLabelText(/End date/i), { target: { value: '2026-07-24' } });

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

    // Success alert should be shown
    expect(await screen.findByText(/Sprint "Sprint 1" created/i)).toBeInTheDocument();
    expect(onSprintUpdated).toHaveBeenCalledWith(mockSprint);

    // Wait for the 1500ms timeout naturally
    await new Promise((resolve) => setTimeout(resolve, 1600));

    expect(onSuccess).toHaveBeenCalled();
  });

  it('fetches sprint details and updates correctly in edit mode', async () => {
    const onSprintUpdated = vi.fn();
    vi.mocked(getSprint).mockResolvedValue(mockSprint);
    vi.mocked(updateSprint).mockResolvedValue({
      ...mockSprint,
      name: 'Sprint 1 Updated',
    });

    render(<SprintForm sprintId="sprint-123" onSprintUpdated={onSprintUpdated} />);

    // Initially loading sprint
    expect(screen.getByText(/Loading sprint details.../i)).toBeInTheDocument();

    await waitFor(() => {
      expect(getSprint).toHaveBeenCalledWith('sprint-123');
    });

    // Verify fields populated
    await waitFor(() => {
      expect(screen.getByLabelText(/Sprint name/i)).toHaveValue('Sprint 1');
      expect(screen.getByLabelText(/Goal/i)).toHaveValue('Achieve project milestone');
      expect(screen.getByLabelText(/Start date/i)).toHaveValue('2026-07-10');
      expect(screen.getByLabelText(/End date/i)).toHaveValue('2026-07-24');
    });

    // Modify name
    fireEvent.change(screen.getByLabelText(/Sprint name/i), { target: { value: 'Sprint 1 Updated' } });

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

    expect(screen.queryByText(/Sprint "Sprint 1" updated/i)).not.toBeInTheDocument(); // old name not shown as updated
    expect(await screen.findByText(/Sprint "Sprint 1 Updated" updated/i)).toBeInTheDocument();
    expect(onSprintUpdated).toHaveBeenCalledWith({
      ...mockSprint,
      name: 'Sprint 1 Updated',
    });
  });

  it('triggers onClose when close button clicked', async () => {
    const onClose = vi.fn();
    render(<SprintForm onClose={onClose} />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading projects.../i)).not.toBeInTheDocument();
    });

    const closeBtn = screen.getByRole('button', { name: /Close modal/i });
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalled();
  });
});
