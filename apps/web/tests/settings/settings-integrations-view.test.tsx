import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SettingsIntegrationsView } from '@/app/settings/_components/settings-integrations-view';
import { resetNextNavigationMock } from '../mocks/next-navigation';

vi.mock('next/navigation', () => import('../mocks/next-navigation'));

vi.mock('@/app/projects/_hooks/use-github-connection-picker', () => ({
  useGithubConnectionPicker: () => ({
    activeConnection: {
      id: 'conn-1',
      name: 'Octocat GitHub',
      account_login: 'octocat',
      account_avatar_url: 'https://github.com/octocat.png',
    },
    isLoadingConnections: false,
    isConnecting: false,
    loadError: null,
    setLoadError: vi.fn(),
    refreshConnections: vi.fn(),
    handleConnectGithub: vi.fn(),
  }),
}));

vi.mock('@/app/projects/_services/projects.github.mutations.client', () => ({
  deleteGithubConnection: vi.fn(),
}));

vi.mock('@/app/settings/_services/integrations.mutations.client', () => ({
  deleteWorkspaceIntegration: vi.fn(),
}));

describe('SettingsIntegrationsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetNextNavigationMock();
  });

  it('renders integration cards including GitHub', () => {
    render(<SettingsIntegrationsView initialIntegrations={[]} />);
    expect(screen.getByText('GitHub')).toBeInTheDocument();
  });

  it('automatically opens GitHub detail dialog when autoOpenPopup is true', () => {
    render(
      <SettingsIntegrationsView
        initialIntegrations={[]}
        autoOpenPopup={true}
        autoOpenIntegration="github"
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('@octocat')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /update connection/i })
    ).toBeInTheDocument();
  });

  it('automatically opens GitHub dialog from window.location.search params', () => {
    window.history.pushState(
      {},
      '',
      '/settings?tab=integrations&showPopup=1&integration=github'
    );

    render(<SettingsIntegrationsView initialIntegrations={[]} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('@octocat')).toBeInTheDocument();

    window.history.pushState({}, '', '/');
  });
});
