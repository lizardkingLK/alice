import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import { ProjectForm } from '@/app/projects/_components/project-form';
import {
  createProject,
  getProject,
  updateProject,
} from '@/app/projects/_services/projects.service';
import type { User } from '@/app/users/_services/users.service';

vi.mock('@/app/projects/_services/projects.service', () => ({
  createProject: vi.fn(),
  getProject: vi.fn(),
  updateProject: vi.fn(),
}));

const mockUsers: User[] = [
  {
    id: 'user-admin',
    name: 'Admin User',
    email: 'admin@alice.dev',
    role: 'admin',
    active: true,
    created_at: '2026-07-09T10:00:00Z',
    updated_at: '2026-07-09T10:00:00Z',
    created_by: null,
    profile_picture: null,
    status: 'active' as const,
    updated_by: null,
  },
  {
    id: 'user-mgr-1',
    name: 'Manager One',
    email: 'mgr1@alice.dev',
    role: 'manager',
    active: true,
    created_at: '2026-07-09T10:00:00Z',
    updated_at: '2026-07-09T10:00:00Z',
    created_by: null,
    profile_picture: null,
    status: 'active' as const,
    updated_by: null,
  },
  {
    id: 'user-mgr-2',
    name: 'Manager Two',
    email: 'mgr2@alice.dev',
    role: 'manager',
    active: true,
    created_at: '2026-07-09T10:00:00Z',
    updated_at: '2026-07-09T10:00:00Z',
    created_by: null,
    profile_picture: null,
    status: 'active' as const,
    updated_by: null,
  },
  {
    id: 'user-member',
    name: 'Member User',
    email: 'member@alice.dev',
    role: 'member',
    active: true,
    created_at: '2026-07-09T10:00:00Z',
    updated_at: '2026-07-09T10:00:00Z',
    created_by: null,
    profile_picture: null,
    status: 'active' as const,
    updated_by: null,
  },
];

const mockProject = {
  id: 'proj-123',
  name: 'Project Alice',
  key: 'ALICE',
  description: 'Project description details',
  owner_id: 'user-mgr-1',
  status: 'active' as const,
  start_date: '2026-07-10',
  end_date: '2026-08-10',
  created_at: '2026-07-09T10:00:00Z',
  updated_at: '2026-07-09T10:00:00Z',
  created_by: null,
  deleted_at: null,
  updated_by: null,
  attributes_config: null,
  workflow_config: null,
  owner: {
    id: 'user-mgr-1',
    name: 'Manager One',
    email: 'mgr1@alice.dev',
  },
};

describe('ProjectForm Component', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders owner dropdown filtered only to managers', () => {
    render(<ProjectForm users={mockUsers} />);

    const ownerSelect = screen.getByLabelText(/Project Owner/i);
    expect(ownerSelect).toBeInTheDocument();

    const hiddenSelect = document.querySelector('select[name="owner_id"]');
    const options = within(hiddenSelect as HTMLElement).getAllByRole('option', {
      hidden: true,
    });
    // Options should be: "Select Owner..." option plus 2 managers = 3 total options.
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveValue('');
    expect(options[1]).toHaveTextContent('Manager One (mgr1@alice.dev)');
    expect(options[2]).toHaveTextContent('Manager Two (mgr2@alice.dev)');
  });

  it('performs required field validation on submit', async () => {
    render(<ProjectForm users={mockUsers} />);

    const form = screen.getByLabelText(/Project Name/i).closest('form')!;
    fireEvent.submit(form);

    expect(
      await screen.findByText(/Project Name, Key, and Owner are required/i)
    ).toBeInTheDocument();
  });

  it('submits correctly in create mode and calls onSuccess', async () => {
    const onSuccess = vi.fn();
    const onProjectUpdated = vi.fn();
    vi.mocked(createProject).mockResolvedValue(mockProject);

    render(
      <ProjectForm
        users={mockUsers}
        onSuccess={onSuccess}
        onProjectUpdated={onProjectUpdated}
      />
    );

    // Fill form
    fireEvent.change(screen.getByLabelText(/Project Name/i), {
      target: { value: 'Project Alice' },
    });
    fireEvent.change(screen.getByLabelText(/Project Key/i), {
      target: { value: 'alice' }, // testing uppercase conversion
    });
    fireEvent.change(screen.getByLabelText(/Description/i), {
      target: { value: 'Project description details' },
    });
    const ownerSelect = screen.getByLabelText(/Project Owner/i);
    fireEvent.click(ownerSelect);
    const option = screen.getByRole('option', {
      name: 'Manager One (mgr1@alice.dev)',
    });
    fireEvent.click(option);
    fireEvent.change(screen.getByLabelText(/Start Date/i), {
      target: { value: '2026-07-10' },
    });
    fireEvent.change(screen.getByLabelText(/End Date/i), {
      target: { value: '2026-08-10' },
    });

    const form = screen.getByLabelText(/Project Name/i).closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(createProject).toHaveBeenCalledWith({
        name: 'Project Alice',
        key: 'ALICE',
        description: 'Project description details',
        owner_id: 'user-mgr-1',
        start_date: '2026-07-10',
        end_date: '2026-08-10',
        status: 'active',
        attributes_config: null,
        workflow_config: null,
      });
    });

    expect(
      await screen.findByText(/Project "Project Alice" created/i)
    ).toBeInTheDocument();
    expect(onProjectUpdated).toHaveBeenCalledWith(mockProject);

    // Wait for the success timeout
    await new Promise((resolve) => setTimeout(resolve, 1300));
    expect(onSuccess).toHaveBeenCalled();
  });

  it('fetches project details and updates correctly in edit mode', async () => {
    const onProjectUpdated = vi.fn();
    vi.mocked(getProject).mockResolvedValue(mockProject);
    vi.mocked(updateProject).mockResolvedValue({
      ...mockProject,
      name: 'Project Alice Updated',
    });

    render(
      <ProjectForm
        projectId="proj-123"
        users={mockUsers}
        onProjectUpdated={onProjectUpdated}
      />
    );

    expect(screen.getByText(/Loading project details.../i)).toBeInTheDocument();

    await waitFor(() => {
      expect(getProject).toHaveBeenCalledWith('proj-123');
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/Project Name/i)).toHaveValue(
        'Project Alice'
      );
      expect(screen.getByLabelText(/Project Key/i)).toHaveValue('ALICE');
      expect(screen.getByLabelText(/Description/i)).toHaveValue(
        'Project description details'
      );
      expect(screen.getByLabelText(/Project Owner/i)).toHaveTextContent(
        'Manager One (mgr1@alice.dev)'
      );
      expect(screen.getByLabelText(/Start Date/i)).toHaveValue('2026-07-10');
      expect(screen.getByLabelText(/End Date/i)).toHaveValue('2026-08-10');
    });

    // Modify fields
    fireEvent.change(screen.getByLabelText(/Project Name/i), {
      target: { value: 'Project Alice Updated' },
    });

    const form = screen.getByLabelText(/Project Name/i).closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(updateProject).toHaveBeenCalledWith('proj-123', {
        name: 'Project Alice Updated',
        key: 'ALICE',
        description: 'Project description details',
        owner_id: 'user-mgr-1',
        start_date: '2026-07-10',
        end_date: '2026-08-10',
        status: 'active',
        attributes_config: null,
        workflow_config: null,
      });
    });

    expect(
      await screen.findByText(/Project "Project Alice Updated" updated/i)
    ).toBeInTheDocument();
    expect(onProjectUpdated).toHaveBeenCalledWith({
      ...mockProject,
      name: 'Project Alice Updated',
    });
  });

  it('triggers onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<ProjectForm users={mockUsers} onClose={onClose} />);

    const closeBtn = screen.getByRole('button', { name: /Close modal/i });
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalled();
  });
});
