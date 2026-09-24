import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GithubSettingsCard } from '@/app/projects/_components/project-details/github-settings-card';
import { projectFactory } from '../factories/project.factory';
import {
  clearGithubCache,
  type GithubConnectionDto,
} from '@/app/projects/_services/projects.github.mutations.client';
import { GithubConnectionStatusEnum } from '@repo/types/api/v1';

vi.mock('next/navigation', () => import('../mocks/next-navigation'));

const mockSave = vi.fn();
const mockSetFailure = vi.fn();

vi.mock('@/app/projects/_hooks/use-integration-settings-save', () => ({
  useIntegrationSettingsSave: () => ({
    isSaving: false,
    message: null,
    isError: false,
    setMessage: vi.fn(),
    setIsError: vi.fn(),
    clearFeedback: vi.fn(),
    setFailure: mockSetFailure,
    save: mockSave,
  }),
}));

const mockRefreshConnections = vi.fn();
const mockHandleConnectGithub = vi.fn();
let mockActiveConnection: GithubConnectionDto | null = null;
let mockConnections: GithubConnectionDto[] = [];

vi.mock('@/app/projects/_hooks/use-github-connection-picker', () => ({
  useGithubConnectionPicker: () => ({
    connections: mockConnections,
    activeConnection: mockActiveConnection,
    repositories: [],
    isLoadingConnections: false,
    isLoadingRepositories: false,
    isConnecting: false,
    loadError: null,
    setLoadError: vi.fn(),
    refreshConnections: mockRefreshConnections,
    handleConnectGithub: mockHandleConnectGithub,
  }),
}));

describe('GitHub Project Integration & Ownership Flow', () => {
  const baseProject = projectFactory.build({
    id: 'proj-1',
    name: 'Apollo',
    github_repo: 'acme/apollo',
  });

  beforeEach(() => {
    vi.clearAllMocks();
    clearGithubCache();
  });

  it('allows the admin who established the connection to modify and disconnect it', () => {
    mockActiveConnection = {
      id: 'conn-admin-1',
      name: 'GitHub (@admin-octocat)',
      status: GithubConnectionStatusEnum.active,
      account_login: 'admin-octocat',
      has_access_token: true,
      has_refresh_token: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_admin_owned: true,
      can_manage: true,
      created_by_user_id: 'admin-user-id',
      created_by_role: 'admin',
    };
    mockConnections = [mockActiveConnection];

    render(
      <GithubSettingsCard
        project={baseProject}
        currentUserId="admin-user-id"
        currentUserRole="admin"
        canEditProject={true}
      />
    );

    // Summary fields
    expect(screen.getByText('acme/apollo')).toBeInTheDocument();
    expect(
      screen.getByText(/@admin-octocat \(OAuth 2.1\)/)
    ).toBeInTheDocument();

    // Modify and Disconnect buttons must be present
    expect(
      screen.getByRole('button', { name: /modify github settings/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /disconnect/i })
    ).toBeInTheDocument();

    // Notice banner must NOT be shown when the user can manage
    expect(
      screen.queryByText(/only that administrator can modify or disconnect/i)
    ).not.toBeInTheDocument();
  });

  it('displays connection as read-only/disabled reference data when manager views admin-owned connection', () => {
    mockActiveConnection = {
      id: 'conn-admin-1',
      name: 'GitHub (@admin-octocat)',
      status: GithubConnectionStatusEnum.active,
      account_login: 'admin-octocat',
      has_access_token: true,
      has_refresh_token: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_admin_owned: true,
      can_manage: false,
      created_by_user_id: 'admin-user-id',
      created_by_role: 'admin',
    };
    mockConnections = [mockActiveConnection];

    render(
      <GithubSettingsCard
        project={baseProject}
        currentUserId="manager-user-id"
        currentUserRole="manager"
        canEditProject={true}
      />
    );

    // Summary reference data is displayed
    expect(screen.getByText('acme/apollo')).toBeInTheDocument();
    expect(
      screen.getByText(/@admin-octocat \(OAuth 2.1\)/)
    ).toBeInTheDocument();

    // Admin-lock banner must be displayed
    expect(
      screen.getByText(
        /this github connection was established by an administrator/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /only that administrator can modify or disconnect this connection/i
      )
    ).toBeInTheDocument();

    // Modify and Disconnect buttons must NOT be rendered for non-owner manager
    expect(
      screen.queryByRole('button', { name: /modify github settings/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /disconnect/i })
    ).not.toBeInTheDocument();
  });

  it('renders read-only reference data for members without management actions', () => {
    mockActiveConnection = {
      id: 'conn-manager-1',
      name: 'GitHub (@mgr-octocat)',
      status: GithubConnectionStatusEnum.active,
      account_login: 'mgr-octocat',
      has_access_token: true,
      has_refresh_token: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_admin_owned: false,
      can_manage: false,
    };
    mockConnections = [mockActiveConnection];

    render(
      <GithubSettingsCard
        project={baseProject}
        currentUserId="member-user-id"
        currentUserRole="member"
        canEditProject={false}
      />
    );

    expect(screen.getByText('acme/apollo')).toBeInTheDocument();
    expect(screen.getByText(/@mgr-octocat \(OAuth 2.1\)/)).toBeInTheDocument();

    // No modify, disconnect, or connect buttons for member
    expect(
      screen.queryByRole('button', { name: /modify github settings/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /disconnect/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /connect github/i })
    ).not.toBeInTheDocument();
  });

  it('validates that only one single repository is allowed when saving', async () => {
    mockActiveConnection = {
      id: 'conn-1',
      name: 'GitHub (@octocat)',
      status: GithubConnectionStatusEnum.active,
      account_login: 'octocat',
      has_access_token: true,
      has_refresh_token: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_admin_owned: false,
      can_manage: true,
    };
    mockConnections = [mockActiveConnection];

    render(
      <GithubSettingsCard
        project={{ ...baseProject, github_repo: null }}
        currentUserId="admin-user-id"
        currentUserRole="admin"
        canEditProject={true}
      />
    );

    // In edit mode since project.github_repo is null
    const urlInput = screen.getByLabelText(/github repository url/i);
    fireEvent.change(urlInput, {
      target: {
        value: 'https://github.com/org/repo1, https://github.com/org/repo2',
      },
    });

    const form = urlInput.closest('form');
    expect(form).toBeInTheDocument();
    fireEvent.submit(form!);

    expect(mockSetFailure).toHaveBeenCalledWith(
      expect.stringContaining(
        'Only one GitHub repository is allowed per project'
      )
    );
    expect(mockSave).not.toHaveBeenCalled();
  });
});
