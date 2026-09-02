import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectForm } from '@/app/projects/_components/project-form';
import {
  createProject,
  updateProject,
} from '@/app/projects/_services/projects.mutations.client';
import type { User } from '@/app/users/_services/users.mutations.client';
import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';
import {
  getComboboxOptions,
  pickComboboxOption,
} from '../helpers/pick-combobox-option';

vi.mock('@/lib/api/api-fetch.mutations.use.client', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('@/app/projects/_services/projects.mutations.client', () => ({
  createProject: vi.fn(),
  updateProject: vi.fn(),
}));

vi.mock('@repo/ui/components/ui/select', () =>
  import('../mocks/select').then((module) => module.createSelectMock())
);

const mockUsers: User[] = [
  {
    id: 'user-admin',
    name: 'Admin User',
    email: 'admin@alice.dev',
    role: 'admin',
    active: true,
    membership_status: 'active',
    created_at: '2026-07-09T10:00:00Z',
    updated_at: '2026-07-09T10:00:00Z',
    created_by: null,
    profile_picture: null,
    cover_picture: null,
    status: 'active' as const,
    updated_by: null,
  },
  {
    id: 'user-mgr-1',
    name: 'Manager One',
    email: 'mgr1@alice.dev',
    role: 'manager',
    active: true,
    membership_status: 'active',
    created_at: '2026-07-09T10:00:00Z',
    updated_at: '2026-07-09T10:00:00Z',
    created_by: null,
    profile_picture: null,
    cover_picture: null,
    status: 'active' as const,
    updated_by: null,
  },
  {
    id: 'user-mgr-2',
    name: 'Manager Two',
    email: 'mgr2@alice.dev',
    role: 'manager',
    active: true,
    membership_status: 'active',
    created_at: '2026-07-09T10:00:00Z',
    updated_at: '2026-07-09T10:00:00Z',
    created_by: null,
    profile_picture: null,
    cover_picture: null,
    status: 'active' as const,
    updated_by: null,
  },
  {
    id: 'user-member',
    name: 'Member User',
    email: 'member@alice.dev',
    role: 'member',
    active: true,
    membership_status: 'active',
    created_at: '2026-07-09T10:00:00Z',
    updated_at: '2026-07-09T10:00:00Z',
    created_by: null,
    profile_picture: null,
    cover_picture: null,
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
  jira_connection_id: null,
  jira_project_key: null,
  github_repo: null,
  has_github_token: false,
  logo_url: null,
  cover_picture: null,
  owner: {
    id: 'user-mgr-1',
    name: 'Manager One',
    email: 'mgr1@alice.dev',
  },
};

const mockJiraConnection = {
  id: 'conn-1',
  user_id: 'user-mgr-1',
  cloud_id: 'cloud-1',
  site_url: 'https://test.atlassian.net',
  account_email: 'me@test.com',
  scopes: 'read:jira-work',
  status: 'active' as const,
  created_at: '2026-07-09T10:00:00Z',
  updated_at: '2026-07-09T10:00:00Z',
};

function mockJiraApiFetch(options?: {
  connections?: (typeof mockJiraConnection)[];
  importedCount?: number;
}) {
  const connections = options?.connections ?? [mockJiraConnection];
  const importedCount = options?.importedCount ?? 2;

  vi.mocked(apiFetch).mockImplementation(async (path: string) => {
    if (path === '/api/jira/connections') {
      return { connections };
    }
    if (path === '/api/jira/connections/conn-1/projects') {
      return {
        projects: [{ id: '10000', key: 'TEST', name: 'Test Project' }],
      };
    }
    if (path === '/api/projects/proj-123/jira/import') {
      return { importedCount };
    }
    if (path === '/api/jira/oauth/start') {
      return { url: 'https://auth.atlassian.com/authorize' };
    }
    throw new Error(`Unexpected apiFetch path: ${path}`);
  });
}

async function fillStep1Basics() {
  fireEvent.change(screen.getByLabelText(/Project Name/i), {
    target: { value: 'Project Alice' },
  });
  fireEvent.change(screen.getByLabelText(/Project Key/i), {
    target: { value: 'alice' },
  });
  await pickComboboxOption(/Project Owner/i, 'Manager One (mgr1@alice.dev)');
}

describe('ProjectForm Component', () => {
  beforeEach(() => {
    mockJiraApiFetch({ connections: [] });
  });

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

    const nextBtn = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextBtn);

    expect(
      await screen.findByText(/Project Name is required/i)
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
      target: { value: '2026-09-10' },
    });
    fireEvent.change(screen.getByLabelText(/End Date/i), {
      target: { value: '2026-10-10' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    fireEvent.click(screen.getByRole('button', { name: /Create Project/i }));

    await waitFor(() => {
      expect(createProject).toHaveBeenCalledWith({
        name: 'Project Alice',
        key: 'ALICE',
        description: 'Project description details',
        owner_id: 'user-mgr-1',
        start_date: '2026-09-10',
        end_date: '2026-10-10',
        status: 'active',
        attributes_config: null,
        workflow_config: null,
        jira_connection_id: null,
        jira_project_key: null,
        github_repo: null,
        github_token: null,
      });
    });

    expect(
      await screen.findByText(/Project "Project Alice" created/i)
    ).toBeInTheDocument();
    expect(onProjectUpdated).toHaveBeenCalledWith(mockProject);

    await waitFor(() => expect(onSuccess).toHaveBeenCalled(), {
      timeout: 2_000,
    });
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

    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

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
          jira_connection_id: null,
          jira_project_key: null,
          github_repo: null,
          github_token: null,
        },
        '2026-07-09T10:00:00Z'
      );
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

  it('shows Jira OAuth fields when checkbox is toggled with an existing connection', async () => {
    mockJiraApiFetch();

    render(<ProjectForm users={mockUsers} />);
    await fillStep1Basics();
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));

    fireEvent.click(screen.getByRole('checkbox', { name: /^Jira$/i }));

    expect(
      await screen.findByRole('button', { name: /Connect Jira/i })
    ).toBeInTheDocument();

    const selects = await screen.findAllByTestId('ui-select');
    expect(selects.length).toBeGreaterThanOrEqual(1);

    fireEvent.change(selects[0]!, { target: { value: 'conn-1' } });

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/jira/connections/conn-1/projects'
      );
    });

    const projectSelect = (await screen.findAllByTestId('ui-select'))[1]!;
    fireEvent.change(projectSelect, { target: { value: 'TEST' } });
    expect(projectSelect).toHaveValue('TEST');
  });

  it('advances from Imports to Source Control without creating the project', async () => {
    mockJiraApiFetch();
    vi.mocked(createProject).mockResolvedValue(mockProject);

    render(<ProjectForm users={mockUsers} />);
    await fillStep1Basics();
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));

    fireEvent.click(screen.getByRole('checkbox', { name: /^Jira$/i }));
    const selects = await screen.findAllByTestId('ui-select');
    fireEvent.change(selects[0]!, { target: { value: 'conn-1' } });
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/jira/connections/conn-1/projects'
      );
    });
    fireEvent.change((await screen.findAllByTestId('ui-select'))[1]!, {
      target: { value: 'TEST' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Next/i }));

    expect(
      await screen.findByRole('checkbox', { name: /^GitHub$/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Create Project/i })
    ).toBeInTheDocument();
    expect(createProject).not.toHaveBeenCalled();
  });

  it('submits project creation and calls Jira import endpoint when checkbox is checked', async () => {
    mockJiraApiFetch({ importedCount: 2 });
    vi.mocked(createProject).mockResolvedValue(mockProject);

    const onSuccess = vi.fn();
    render(<ProjectForm users={mockUsers} onSuccess={onSuccess} />);

    await fillStep1Basics();
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));

    fireEvent.click(screen.getByRole('checkbox', { name: /^Jira$/i }));

    const selects = await screen.findAllByTestId('ui-select');
    fireEvent.change(selects[0]!, { target: { value: 'conn-1' } });

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/jira/connections/conn-1/projects'
      );
    });

    const projectSelect = (await screen.findAllByTestId('ui-select'))[1]!;
    fireEvent.change(projectSelect, { target: { value: 'TEST' } });

    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    fireEvent.click(screen.getByRole('button', { name: /Create Project/i }));

    await waitFor(() => {
      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          jira_connection_id: 'conn-1',
          jira_project_key: 'TEST',
        })
      );
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/projects/proj-123/jira/import',
        { method: 'POST', timeoutMs: 90_000 }
      );
    });

    expect(
      await screen.findByText(/tasks successfully imported from Jira/i)
    ).toBeInTheDocument();
  });

  it('submits project creation with GitHub Repository URL when GitHub is enabled', async () => {
    vi.mocked(createProject).mockResolvedValue(mockProject);

    render(<ProjectForm users={mockUsers} />);

    await fillStep1Basics();
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));

    fireEvent.click(screen.getByRole('checkbox', { name: /^GitHub$/i }));

    fireEvent.change(screen.getByLabelText(/GitHub Repository URL/i), {
      target: { value: 'https://github.com/facebook/react' },
    });
    fireEvent.change(
      screen.getByLabelText(/Personal Access Token \(optional\)/i),
      {
        target: { value: 'ghp_secret_token_123' },
      }
    );

    fireEvent.click(screen.getByRole('button', { name: /Create Project/i }));

    await waitFor(() => {
      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          github_repo: 'facebook/react',
          github_token: 'ghp_secret_token_123',
        })
      );
    });
  });

  it('automatically splits GitHub Repository URL into owner and repository name', async () => {
    vi.mocked(createProject).mockResolvedValue(mockProject);

    render(<ProjectForm users={mockUsers} />);

    await fillStep1Basics();
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));

    fireEvent.click(screen.getByRole('checkbox', { name: /^GitHub$/i }));

    fireEvent.change(screen.getByLabelText(/GitHub Repository URL/i), {
      target: { value: 'https://github.com/facebook/react.git' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Create Project/i }));

    await waitFor(() => {
      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          github_repo: 'facebook/react',
        })
      );
    });
  });



  it('omits blank github_token on edit so existing PAT is unchanged', async () => {
    const onProjectUpdated = vi.fn();
    const projectWithGithub = {
      ...mockProject,
      github_repo: 'facebook/react',
      has_github_token: true,
    };
    vi.mocked(updateProject).mockResolvedValue(projectWithGithub);

    render(
      <ProjectForm
        projectToEdit={projectWithGithub}
        users={mockUsers}
        onProjectUpdated={onProjectUpdated}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(updateProject).toHaveBeenCalledWith(
        'proj-123',
        expect.objectContaining({
          github_repo: 'facebook/react',
          github_token: undefined,
        }),
        '2026-07-09T10:00:00Z'
      );
    });
  });

  it('validates that end date cannot be a past date during creation', async () => {
    render(<ProjectForm users={mockUsers} />);

    fireEvent.change(screen.getByLabelText(/Project Name/i), {
      target: { value: 'Project Alice' },
    });
    fireEvent.change(screen.getByLabelText(/Project Key/i), {
      target: { value: 'ALICE' },
    });
    await pickComboboxOption(/Project Owner/i, 'Manager One (mgr1@alice.dev)');

    const pastDate = new Date();
    pastDate.setFullYear(pastDate.getFullYear() - 1);
    const pastDateStr = pastDate.toISOString().split('T')[0];

    fireEvent.change(screen.getByLabelText(/End Date/i), {
      target: { value: pastDateStr },
    });

    const nextBtn = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextBtn);

    expect(
      await screen.findByText(/End Date cannot be a past date/i)
    ).toBeInTheDocument();
  });

  it('validates that end date cannot be before start date', async () => {
    render(<ProjectForm users={mockUsers} />);

    fireEvent.change(screen.getByLabelText(/Project Name/i), {
      target: { value: 'Project Alice' },
    });
    fireEvent.change(screen.getByLabelText(/Project Key/i), {
      target: { value: 'ALICE' },
    });
    await pickComboboxOption(/Project Owner/i, 'Manager One (mgr1@alice.dev)');

    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    const earlierDate = new Date(futureDate);
    earlierDate.setDate(futureDate.getDate() - 1);
    const earlierDateStr = earlierDate.toISOString().split('T')[0];

    fireEvent.change(screen.getByLabelText(/Start Date/i), {
      target: { value: futureDateStr },
    });
    fireEvent.change(screen.getByLabelText(/End Date/i), {
      target: { value: earlierDateStr },
    });

    const nextBtn = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextBtn);

    expect(
      await screen.findByText(/End Date must be on or after the Start Date/i)
    ).toBeInTheDocument();
  });

  it('validates that changed start date in edit mode cannot be a past date', async () => {
    const onProjectUpdated = vi.fn();
    render(
      <ProjectForm
        projectToEdit={mockProject}
        users={mockUsers}
        onProjectUpdated={onProjectUpdated}
      />
    );

    const pastDate = new Date();
    pastDate.setFullYear(pastDate.getFullYear() - 1);
    const pastDateStr = pastDate.toISOString().split('T')[0];

    fireEvent.change(screen.getByLabelText(/Start Date/i), {
      target: { value: pastDateStr },
    });

    const nextBtn = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextBtn);

    expect(
      await screen.findByText(/Start Date cannot be a past date/i)
    ).toBeInTheDocument();
  });

  it('validates that changed end date in edit mode cannot be a past date', async () => {
    const onProjectUpdated = vi.fn();
    render(
      <ProjectForm
        projectToEdit={mockProject}
        users={mockUsers}
        onProjectUpdated={onProjectUpdated}
      />
    );

    const pastDate = new Date();
    pastDate.setFullYear(pastDate.getFullYear() - 1);
    const pastDateStr = pastDate.toISOString().split('T')[0];

    fireEvent.change(screen.getByLabelText(/End Date/i), {
      target: { value: pastDateStr },
    });

    const nextBtn = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextBtn);

    expect(
      await screen.findByText(/End Date cannot be a past date/i)
    ).toBeInTheDocument();
  });

  it('allows saving in edit mode if existing past dates are not changed', async () => {
    const onProjectUpdated = vi.fn();
    vi.mocked(updateProject).mockResolvedValue({
      ...mockProject,
      name: 'Project Alice Updated',
    });

    const oldProject = {
      ...mockProject,
      start_date: '2020-01-01',
      end_date: '2020-02-01',
    };

    render(
      <ProjectForm
        projectToEdit={oldProject}
        users={mockUsers}
        onProjectUpdated={onProjectUpdated}
      />
    );

    fireEvent.change(screen.getByLabelText(/Project Name/i), {
      target: { value: 'Project Alice Updated' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(updateProject).toHaveBeenCalled();
    });
  });
});
