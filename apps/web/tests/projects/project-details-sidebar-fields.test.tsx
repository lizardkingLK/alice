import { describe, expect, it, vi } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from '@testing-library/react';
import { parseProjectDetailsTab } from '@/lib/search-params';
import { ProjectDetailsWorkspace } from '@/app/projects/_components/project-details/project-details-workspace';
import { ProjectFieldsWorkspace } from '@/app/projects/_components/project-details/project-fields-workspace';
import type { Project } from '@/app/projects/_services/projects.mutations.client';

vi.mock('next/navigation', () => {
  let searchParamsValue = new URLSearchParams();
  return {
    useRouter: () => ({
      push: vi.fn(),
      refresh: vi.fn(),
    }),
    usePathname: () => '/projects/project-1',
    useSearchParams: () => searchParamsValue,
    __setSearchParams: (params: URLSearchParams) => {
      searchParamsValue = params;
    },
  };
});

vi.mock(
  '@/app/projects/_components/project-details/project-summary-banner',
  () => ({
    ProjectSummaryBanner: () => (
      <div data-testid="project-summary-banner">Project Banner</div>
    ),
  })
);

vi.mock(
  '@/app/projects/_components/project-details/project-details-tab',
  () => ({
    ProjectDetailsTab: () => (
      <div data-testid="project-details-tab">Details Content</div>
    ),
  })
);

vi.mock(
  '@/app/projects/_components/project-details/project-members-tab',
  () => ({
    ProjectMembersTab: () => (
      <div data-testid="project-members-tab">Members Content</div>
    ),
  })
);

vi.mock(
  '@/app/projects/_components/project-details/project-teams-panel',
  () => ({
    ProjectTeamsPanel: () => (
      <div data-testid="project-teams-panel">Teams Content</div>
    ),
  })
);

vi.mock(
  '@/app/projects/_components/project-details/project-integrations-tab',
  () => ({
    ProjectIntegrationsTab: () => (
      <div data-testid="project-integrations-tab">Integrations Content</div>
    ),
  })
);

vi.mock('@/app/work-items/_components/work-items-workspace', () => ({
  default: () => (
    <div data-testid="work-items-workspace">Work Items Content</div>
  ),
}));

vi.mock('@/app/projects/_services/projects.mutations.client', () => ({
  updateProjectFieldsConfig: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/api/api-fetch.reads.use.client', () => ({
  apiFetch: vi.fn().mockResolvedValue({ workItems: [] }),
}));

const mockProject: Project = {
  id: 'project-1',
  name: 'Mobile App',
  key: 'MOB',
  description: 'Mobile iOS and Android app',
  status: 'active',
  start_date: null,
  end_date: null,
  owner_id: 'user-manager-1',
  created_by: 'user-admin-1',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
  updated_by: null,
  jira_project_key: null,
  jira_connection_id: null,
  github_repo: null,
  logo_url: null,
  cover_picture: null,
  attributes_config: {
    type: 'object',
    properties: {
      moscowRating: {
        type: 'string',
        title: 'MoSCoW Rating',
        enum: ['Must', 'Should', 'Could', "Won't"],
      },
    },
  },
  workflow_config: null,
};

describe('parseProjectDetailsTab', () => {
  it('parses "fields" tab parameter', () => {
    expect(parseProjectDetailsTab('fields')).toBe('fields');
  });

  it('parses standard tab parameters', () => {
    expect(parseProjectDetailsTab('details')).toBe('details');
    expect(parseProjectDetailsTab('members')).toBe('members');
    expect(parseProjectDetailsTab('teams')).toBe('teams');
    expect(parseProjectDetailsTab('work-items')).toBe('work-items');
    expect(parseProjectDetailsTab('integrations')).toBe('integrations');
  });

  it('falls back to "details" for unknown or empty values', () => {
    expect(parseProjectDetailsTab(null)).toBe('details');
    expect(parseProjectDetailsTab(undefined)).toBe('details');
    expect(parseProjectDetailsTab('non-existent')).toBe('details');
  });
});

describe('ProjectDetailsWorkspace sidebar and banner isolation', () => {
  it('renders all 6 navigation options in the sidebar', () => {
    render(
      <ProjectDetailsWorkspace
        project={mockProject}
        members={[]}
        allUsers={[]}
        currentUserId="user-manager-1"
        currentUserRole="manager"
        workItems={{
          initialWorkItems: [],
          totalCount: 0,
          page: 1,
          limit: 10,
          totalPages: 1,
          search: '',
          typeFilter: '',
          assigneeFilter: '',
          listView: 'flat',
          tab: 'active',
        }}
        teams={{
          items: [],
          totalCount: 0,
          page: 1,
          limit: 10,
          totalPages: 1,
          search: '',
          status: 'active',
        }}
      />
    );

    expect(
      screen.getByRole('button', { name: /details/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /members/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /teams/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /work items/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /integrations/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /fields/i })).toBeInTheDocument();
  });

  it('renders ProjectSummaryBanner when Details tab is active', () => {
    render(
      <ProjectDetailsWorkspace
        project={mockProject}
        members={[]}
        allUsers={[]}
        currentUserId="user-manager-1"
        currentUserRole="manager"
        workItems={{
          initialWorkItems: [],
          totalCount: 0,
          page: 1,
          limit: 10,
          totalPages: 1,
          search: '',
          typeFilter: '',
          assigneeFilter: '',
          listView: 'flat',
          tab: 'active',
        }}
        teams={{
          items: [],
          totalCount: 0,
          page: 1,
          limit: 10,
          totalPages: 1,
          search: '',
          status: 'active',
        }}
      />
    );

    expect(screen.getByTestId('project-summary-banner')).toBeInTheDocument();
    expect(screen.getByTestId('project-details-tab')).toBeInTheDocument();
  });
});

describe('ProjectFieldsWorkspace component', () => {
  it('renders heading, description, and action buttons', () => {
    render(
      <ProjectFieldsWorkspace project={mockProject} isManagerOrAdmin={true} />
    );

    expect(
      screen.getByRole('heading', { name: /dynamic fields/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /load template/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /beautify/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /validate/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /save changes/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /generate with alice/i })
    ).toBeInTheDocument();
  });

  it('renders configured field cards from project attributes_config', () => {
    render(
      <ProjectFieldsWorkspace project={mockProject} isManagerOrAdmin={true} />
    );

    expect(screen.getByText('MoSCoW Rating')).toBeInTheDocument();
    expect(screen.getByText('key: moscowRating')).toBeInTheDocument();
    expect(screen.getByText('Must')).toBeInTheDocument();
    expect(screen.getByText('Should')).toBeInTheDocument();
  });

  it('shows read-only banner and disables editing when user is not a manager or admin', () => {
    render(
      <ProjectFieldsWorkspace project={mockProject} isManagerOrAdmin={false} />
    );

    expect(
      screen.getByText(
        /you have view-only access to this project's dynamic fields configuration/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /save changes/i })
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: /beautify/i })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /load template/i })
    ).toBeDisabled();
  });

  it('allows loading template via dialog and validates syntax', () => {
    render(
      <ProjectFieldsWorkspace
        project={{ ...mockProject, attributes_config: null }}
        isManagerOrAdmin={true}
      />
    );

    // Click load template to open dialog
    const loadBtn = screen.getByRole('button', { name: /load template/i });
    fireEvent.click(loadBtn);

    // Dialog title appears
    expect(screen.getByText('Load Field Templates')).toBeInTheDocument();

    // Click Add Selected button
    const addBtn = screen.getByRole('button', { name: /add selected/i });
    fireEvent.click(addBtn);

    // Validate button
    const validateBtn = screen.getByRole('button', { name: /validate/i });
    fireEvent.click(validateBtn);

    expect(
      screen.getByText(/schema is syntactically valid/i)
    ).toBeInTheDocument();
  });

  it('calls updateProjectFieldsConfig with expectedUpdatedAt on save', async () => {
    const { updateProjectFieldsConfig } =
      await import('@/app/projects/_services/projects.mutations.client');
    render(
      <ProjectFieldsWorkspace project={mockProject} isManagerOrAdmin={true} />
    );

    const saveBtn = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(saveBtn);

    expect(updateProjectFieldsConfig).toHaveBeenCalledWith(
      mockProject.id,
      expect.objectContaining({
        properties: expect.any(Object),
      }),
      mockProject.updated_at
    );
  });

  it('renders line numbers in the editor corresponding to schema lines', () => {
    render(
      <ProjectFieldsWorkspace project={mockProject} isManagerOrAdmin={true} />
    );

    // Verify line count text
    expect(screen.getByText(/lines? • draft 2020-12/i)).toBeInTheDocument();

    // Verify line numbers gutter contains line 1
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('displays status messages in the green banner area and auto-dismisses after timer', () => {
    vi.useFakeTimers();
    render(
      <ProjectFieldsWorkspace
        project={{ ...mockProject, attributes_config: null }}
        isManagerOrAdmin={true}
      />
    );

    // Beautify
    fireEvent.click(screen.getByRole('button', { name: /beautify/i }));
    expect(
      screen.getByText(/json formatted successfully/i)
    ).toBeInTheDocument();

    // Fast-forward 5000ms
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Banner has auto-dismissed
    expect(
      screen.queryByText(/json formatted successfully/i)
    ).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('merges selected template fields into existing schema without wiping out existing fields', () => {
    render(
      <ProjectFieldsWorkspace project={mockProject} isManagerOrAdmin={true} />
    );

    // Initial schema has MoSCoW Rating
    expect(screen.getByText('MoSCoW Rating')).toBeInTheDocument();

    // Click Load Template
    const loadBtn = screen.getByRole('button', { name: /load template/i });
    fireEvent.click(loadBtn);

    // Dialog opens; already added fields show "Added" badge
    expect(screen.getByText('Load Field Templates')).toBeInTheDocument();
    expect(screen.getAllByText('Added')).toHaveLength(1);

    // Select an unadded template field, e.g. Defect Severity
    const severityCard = screen.getByText('Defect Severity');
    fireEvent.click(severityCard);

    // Click Add Selected
    const addBtn = screen.getByRole('button', { name: /add selected/i });
    fireEvent.click(addBtn);

    // Success banner displays
    expect(screen.getByText(/added 1 template field/i)).toBeInTheDocument();

    // Both previous fields and newly added field are present in Configured Fields preview
    expect(screen.getByText('MoSCoW Rating')).toBeInTheDocument();
    expect(screen.getByText('Defect Severity')).toBeInTheDocument();
  });

  it('allows unselecting an existing template field and removes it from schema upon applying', () => {
    render(
      <ProjectFieldsWorkspace project={mockProject} isManagerOrAdmin={true} />
    );

    // Initially MoSCoW Rating is present
    expect(screen.getByText('MoSCoW Rating')).toBeInTheDocument();

    // Open Load Template dialog
    fireEvent.click(screen.getByRole('button', { name: /load template/i }));
    expect(screen.getByText('Load Field Templates')).toBeInTheDocument();

    // Click MoSCoW Rating card to unselect it
    const moscowCard = document
      .getElementById('template-checkbox-moscowRating')!
      .closest('[role="checkbox"]')!;
    fireEvent.click(moscowCard);

    // Apply change
    const addBtn = screen.getByRole('button', { name: /add selected/i });
    fireEvent.click(addBtn);

    // Schema now has 0 dynamic fields
    expect(
      screen.getByText(/no dynamic fields configured yet/i)
    ).toBeInTheDocument();
    expect(screen.queryByText('key: moscowRating')).not.toBeInTheDocument();
  });

  it('displays warning popup with OK and Cancel when unselecting a template with work item values', async () => {
    const { apiFetch } = await import('@/lib/api/api-fetch.reads.use.client');
    vi.mocked(apiFetch).mockResolvedValueOnce({
      workItems: [
        {
          id: 'wi-1',
          title: 'Implement Authentication',
          description: {
            type: 'doc',
            attrs: {
              dynamicFields: {
                moscowRating: 'Must',
              },
            },
          },
        },
      ],
    } as never);

    render(
      <ProjectFieldsWorkspace project={mockProject} isManagerOrAdmin={true} />
    );

    // Open Load Template dialog
    fireEvent.click(screen.getByRole('button', { name: /load template/i }));
    expect(screen.getByText('Load Field Templates')).toBeInTheDocument();

    // Wait for work items to be fetched
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalled();
    });

    // Try to unselect MoSCoW Rating
    const moscowCard = document
      .getElementById('template-checkbox-moscowRating')!
      .closest('[role="checkbox"]')!;
    fireEvent.click(moscowCard);

    // Warning confirmation popup should appear
    expect(
      screen.getByText('Remove Field Template: MoSCoW Rating')
    ).toBeInTheDocument();
    expect(
      screen.getByText(/work item values will be removed under this template/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Implement Authentication: Must/)
    ).toBeInTheDocument();

    // Cancel button in warning popup
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    expect(cancelBtn).toBeInTheDocument();

    // Click Cancel - field should remain selected
    fireEvent.click(cancelBtn);
    expect(
      screen.queryByText('Remove Field Template: MoSCoW Rating')
    ).not.toBeInTheDocument();

    // Try unselecting again and click OK to confirm
    fireEvent.click(moscowCard);
    expect(
      screen.getByText('Remove Field Template: MoSCoW Rating')
    ).toBeInTheDocument();

    const okBtn = screen.getByRole('button', { name: /ok/i });
    fireEvent.click(okBtn);

    // Popup closed and field is unselected
    expect(
      screen.queryByText('Remove Field Template: MoSCoW Rating')
    ).not.toBeInTheDocument();

    // Click Add Selected to apply
    const addBtn = screen.getByRole('button', { name: /add selected/i });
    fireEvent.click(addBtn);

    expect(screen.getByText(/removed 1 template field/i)).toBeInTheDocument();
  });

  it('renders footer buttons clearly with proper spacing on the right side', () => {
    render(
      <ProjectFieldsWorkspace project={mockProject} isManagerOrAdmin={true} />
    );

    fireEvent.click(screen.getByRole('button', { name: /load template/i }));

    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    const addBtn = screen.getByRole('button', { name: /add selected/i });

    expect(cancelBtn).toBeInTheDocument();
    expect(addBtn).toBeInTheDocument();

    // Verify footer container layout classes
    const footer = cancelBtn.closest('[data-slot="dialog-footer"]');
    expect(footer).toBeInTheDocument();
    expect(footer?.className).toContain('justify-end');
    expect(footer?.className).toContain('gap-3');
    expect(footer?.className).toContain('m-0');
    expect(footer?.className).toContain('px-6');
    expect(footer?.className).toContain('py-4');
  });
});
