import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectSettingsTab } from '@/app/projects/_components/project-details/project-settings-tab';
import { JiraImportDialog } from '@/app/projects/_components/project-details/jira-import-dialog';
import { WorkItemForm } from '@/app/work-items/_components/work-item-form/work-item-form';
import {
  updateProject,
  type Project,
} from '@/app/projects/_services/projects.mutations.client';
import {
  previewJiraImport,
  importJiraIssues,
} from '@/app/projects/_services/projects.jira.mutations.client';
import {
  buildDefaultProjectTypeDefs,
  resolveProjectHierarchy,
} from '@repo/types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/projects/project-1',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/app/projects/_services/projects.mutations.client', () => ({
  updateProject: vi.fn(),
}));

vi.mock('@/app/projects/_services/projects.jira.mutations.client', () => ({
  previewJiraImport: vi.fn(),
  importJiraIssues: vi.fn(),
}));

vi.mock('@/lib/optimistic-lock/run-locked-mutation', () => ({
  runLockedMutationOrThrow: vi.fn(async ({ mutate }) => mutate()),
}));

const mockProject: Project = {
  id: 'proj-1',
  name: 'Alpha Project',
  key: 'ALPHA',
  description: 'Test project description',
  status: 'active',
  owner_id: 'user-1',
  start_date: '2026-01-01',
  end_date: '2026-12-31',
  attributes_config: null,
  workflow_config: {
    work_item_types: buildDefaultProjectTypeDefs([
      'Epic',
      'Story',
      'Task',
      'Issue',
    ]),
  } as unknown as Project['workflow_config'],
  jira_connection_id: 'conn-1',
  jira_project_key: 'JIRA_ALPHA',
  github_repo: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  deleted_at: null,
  created_by: 'user-1',
  updated_by: 'user-1',
  cover_picture: null,
  logo_url: null,
};

describe('ProjectSettingsTab Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders configured work item types in the catalog editor', () => {
    render(
      <ProjectSettingsTab project={mockProject} isManagerOrAdmin={true} />
    );

    expect(screen.getByText('Work-Item Types')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Epic')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Story')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Task')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Issue')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Add type/i })
    ).toBeInTheDocument();
  });

  it('shows warning alert when an existing type is removed', () => {
    render(
      <ProjectSettingsTab project={mockProject} isManagerOrAdmin={true} />
    );

    const removeButtons = screen.getAllByRole('button', { name: /Remove/i });
    fireEvent.click(removeButtons[1]!);
    fireEvent.click(screen.getByRole('button', { name: /^Remove type$/i }));

    expect(
      screen.getByText(/Existing items need a resolution strategy/i)
    ).toBeInTheDocument();
  });

  it('keeps at least one type (remove disabled for sole type)', () => {
    render(
      <ProjectSettingsTab
        project={{
          ...mockProject,
          workflow_config: {
            work_item_types: buildDefaultProjectTypeDefs(['Task']),
          } as unknown as Project['workflow_config'],
        }}
        isManagerOrAdmin={true}
      />
    );

    expect(screen.getByRole('button', { name: /^Remove$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Save Types/i })).toBeDisabled();
  });

  it('calls updateProject with catalog defs when saved', async () => {
    const nextDefs = buildDefaultProjectTypeDefs([
      'Epic',
      'Story',
      'Task',
      'Issue',
    ]);
    vi.mocked(updateProject).mockResolvedValue({
      ...mockProject,
      workflow_config: {
        work_item_types: nextDefs,
      } as unknown as Project['workflow_config'],
    });

    render(
      <ProjectSettingsTab project={mockProject} isManagerOrAdmin={true} />
    );

    fireEvent.click(screen.getByRole('button', { name: /Add type/i }));
    const saveButton = screen.getByRole('button', { name: /Save Types/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(updateProject).toHaveBeenCalledWith(
        'proj-1',
        expect.objectContaining({
          workflow_config: expect.objectContaining({
            work_item_types: expect.arrayContaining([
              expect.objectContaining({ key: 'Epic' }),
              expect.objectContaining({ key: expect.any(String) }),
            ]),
          }),
        }),
        '2026-01-01T00:00:00Z'
      );
    });
  });

  it('shows read-only view when user is not a manager or admin', () => {
    render(
      <ProjectSettingsTab project={mockProject} isManagerOrAdmin={false} />
    );

    expect(
      screen.getByText(
        /Only Project Managers and Administrators can configure work-item types/i
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Save Types/i })
    ).not.toBeInTheDocument();
  });
});

describe('WorkItemForm Type Scoping', () => {
  it('restricts work item type dropdown to project allowed types', () => {
    const projectWithSingleType: Project = {
      ...mockProject,
      id: 'proj-single',
      workflow_config: {
        work_item_types: buildDefaultProjectTypeDefs(['Issue']),
      } as unknown as Project['workflow_config'],
    };

    render(
      <WorkItemForm
        onSuccess={vi.fn()}
        projects={[projectWithSingleType]}
        lockProject={true}
        projectMembers={[]}
      />
    );

    expect(screen.getAllByText('Issue').length).toBeGreaterThan(0);
  });
});

describe('JiraImportDialog Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads Jira preview mappings for discovered types', async () => {
    vi.mocked(previewJiraImport).mockResolvedValue({
      issues: [],
      issueTypes: ['Epic', 'Story'],
    });

    render(
      <JiraImportDialog
        open={true}
        onOpenChange={vi.fn()}
        project={mockProject}
      />
    );

    await waitFor(() => {
      expect(previewJiraImport).toHaveBeenCalled();
    });
  });

  it('accepts import config submission mocks', async () => {
    vi.mocked(previewJiraImport).mockResolvedValue({
      issues: [],
      issueTypes: ['Bug'],
    });
    vi.mocked(importJiraIssues).mockResolvedValue({
      importedCount: 1,
    });

    render(
      <JiraImportDialog
        open={true}
        onOpenChange={vi.fn()}
        project={mockProject}
      />
    );

    await waitFor(() => {
      expect(previewJiraImport).toHaveBeenCalled();
    });
  });
});

describe('resolveProjectHierarchy with catalog defs', () => {
  it('derives parent-child from levels', () => {
    const defs = buildDefaultProjectTypeDefs([
      'Epic',
      'Story',
      'Task',
      'Issue',
    ]);
    const { parentToChild } = resolveProjectHierarchy(null, null, defs);
    expect(parentToChild.Epic).toBe('Story');
    expect(parentToChild.Story).toBe('Task');
    expect(parentToChild.Task).toBe('Issue');
  });
});
