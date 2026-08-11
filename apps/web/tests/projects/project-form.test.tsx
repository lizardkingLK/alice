import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectForm } from '@/app/projects/_components/project-form';
import {
  createProject,
  updateProject,
} from '@/app/projects/_services/projects.service';
import type { User } from '@/app/users/_services/users.service';
import { apiFetch } from '@/lib/api/api-client';
import {
  getComboboxOptions,
  pickComboboxOption,
} from '../helpers/pick-combobox-option';

vi.mock('@/lib/api/api-client', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('@/app/projects/_services/projects.service', () => ({
  createProject: vi.fn(),
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
  github_owner: null,
  github_repo: null,
  github_token: null,
  jira_url: null,
  jira_email: null,
  jira_token: null,
  jira_project_key: null,
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

  it('renders owner dropdown filtered only to managers', async () => {
    render(<ProjectForm users={mockUsers} />);

    const ownerSelect = screen.getByLabelText(/Project Owner/i);
    expect(ownerSelect).toBeInTheDocument();

    const options = await getComboboxOptions(/Project Owner/i);
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent('Manager One (mgr1@alice.dev)');
    expect(options[1]).toHaveTextContent('Manager Two (mgr2@alice.dev)');
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

    fireEvent.change(screen.getByLabelText(/Project Name/i), {
      target: { value: 'Project Alice' },
    });
    fireEvent.change(screen.getByLabelText(/Project Key/i), {
      target: { value: 'alice' },
    });
    fireEvent.change(screen.getByLabelText(/Description/i), {
      target: { value: 'Project description details' },
    });
    await pickComboboxOption(/Project Owner/i, 'Manager One (mgr1@alice.dev)');
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
        jira_url: null,
        jira_project_key: null,
        github_owner: null,
        github_repo: null,
        github_token: null,
      });
    },{ timeout: 5000 });

    expect(
      await screen.findByText(/Project "Project Alice" created/i)
    ).toBeInTheDocument();
    expect(onProjectUpdated).toHaveBeenCalledWith(mockProject);

    await new Promise((resolve) => setTimeout(resolve, 1300));
    expect(onSuccess).toHaveBeenCalled();
  });

  it('populates fields from projectToEdit and updates correctly in edit mode', async () => {
    const onProjectUpdated = vi.fn();
    vi.mocked(updateProject).mockResolvedValue({
      ...mockProject,
      name: 'Project Alice Updated',
    });

    render(
      <ProjectForm
        projectToEdit={mockProject}
        users={mockUsers}
        onProjectUpdated={onProjectUpdated}
      />
    );

    expect(screen.getByLabelText(/Project Name/i)).toHaveValue('Project Alice');
    expect(screen.getByLabelText(/Project Key/i)).toHaveValue('ALICE');
    expect(screen.getByLabelText(/Description/i)).toHaveValue(
      'Project description details'
    );
    expect(screen.getByLabelText(/Project Owner/i)).toHaveValue(
      'Manager One (mgr1@alice.dev)'
    );
    expect(screen.getByLabelText(/Start Date/i)).toHaveValue('2026-07-10');
    expect(screen.getByLabelText(/End Date/i)).toHaveValue('2026-08-10');

    fireEvent.change(screen.getByLabelText(/Project Name/i), {
      target: { value: 'Project Alice Updated' },
    });

    const form = screen.getByLabelText(/Project Name/i).closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(updateProject).toHaveBeenCalledWith(
        'proj-123',
        {
          name: 'Project Alice Updated',
          key: 'ALICE',
          description: 'Project description details',
          owner_id: 'user-mgr-1',
          start_date: '2026-07-10',
          end_date: '2026-08-10',
          status: 'active',
          attributes_config: null,
          workflow_config: null,
          jira_url: null,
          jira_project_key: null,
          github_owner: null,
          github_repo: null,
          github_token: undefined,
        },
        '2026-07-09T10:00:00Z'
      );
    },{ timeout: 5000 });

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

  it('shows Jira fields when checkbox is toggled and tests connection successfully', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      issues: [
        { key: 'JIRA-1', title: 'Issue 1 from Jira', type: 'Story' },
        { key: 'JIRA-2', title: 'Issue 2 from Jira', type: 'Bug' },
      ],
    });

    render(<ProjectForm users={mockUsers} />);

    // Toggle Checkbox
    const checkbox = screen.getByLabelText(/Import tasks from Jira Cloud/i);
    fireEvent.click(checkbox);

    // Verify Jira input fields are rendered
    expect(
      screen.getByLabelText(/Jira Cloud URL \/ Domain/i)
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Jira Project Key/i)).toBeInTheDocument();

    // Fill in integration credentials
    fireEvent.change(screen.getByLabelText(/Jira Cloud URL \/ Domain/i), {
      target: { value: 'test.atlassian.net' },
    });
    fireEvent.change(screen.getByLabelText(/Jira Project Key/i), {
      target: { value: 'TEST' },
    });

    // Click Connection Test
    const testBtn = screen.getByRole('button', {
      name: /Test Connection & Preview/i,
    });
    fireEvent.click(testBtn);

    // Verify loading and preview items render
    expect(
      await screen.findByText(
        /Successfully connected! Found 2 tasks ready to import/i
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Issue 1 from Jira')).toBeInTheDocument();
    expect(screen.getByText('Issue 2 from Jira')).toBeInTheDocument();

    expect(apiFetch).toHaveBeenCalledWith('/api/projects/jira/preview', {
      method: 'POST',
      body: JSON.stringify({
        jiraUrl: 'test.atlassian.net',
        jiraProjectKey: 'TEST',
      }),
    });
  });

  it('submits project creation and calls Jira import endpoint when checkbox is checked', async () => {
    vi.mocked(createProject).mockResolvedValue(mockProject);
    vi.mocked(apiFetch).mockResolvedValue({ success: true, importedCount: 2 });

    const onSuccess = vi.fn();
    render(<ProjectForm users={mockUsers} onSuccess={onSuccess} />);

    // Fill project details
    fireEvent.change(screen.getByLabelText(/Project Name/i), {
      target: { value: 'Project Alice' },
    });
    fireEvent.change(screen.getByLabelText(/Project Key/i), {
      target: { value: 'alice' },
    });
    await pickComboboxOption(/Project Owner/i, 'Manager One (mgr1@alice.dev)');

    // Toggle Jira checkbox
    fireEvent.click(screen.getByLabelText(/Import tasks from Jira Cloud/i));

    // Fill integration details
    fireEvent.change(screen.getByLabelText(/Jira Cloud URL \/ Domain/i), {
      target: { value: 'test.atlassian.net' },
    });
    fireEvent.change(screen.getByLabelText(/Jira Project Key/i), {
      target: { value: 'TEST' },
    });

    // Submit form
    const form = screen.getByLabelText(/Project Name/i).closest('form')!;
    fireEvent.submit(form);

    // Verify project is created first, then apiFetch is called to import tasks
    await waitFor(() => {
      expect(createProject).toHaveBeenCalled();
      expect(apiFetch).toHaveBeenCalledWith('/api/projects/jira/import', {
        method: 'POST',
        body: JSON.stringify({
          projectId: 'proj-123',
          jiraUrl: 'test.atlassian.net',
          jiraProjectKey: 'TEST',
        }),
      });
    });

    expect(
      await screen.findByText(/tasks successfully imported from Jira/i)
    ).toBeInTheDocument();
  });
});
