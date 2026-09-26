import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { SettingsIntegrationsView } from '@/app/settings/_components/settings-integrations-view';
import { resetNextNavigationMock } from '../mocks/next-navigation';

vi.mock('next/navigation', () => import('../mocks/next-navigation'));

vi.mock('@/app/settings/_services/integrations.mutations.client', () => ({
  deleteWorkspaceIntegration: vi.fn(),
}));

describe('SettingsIntegrationsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetNextNavigationMock();
  });

  it('renders workspace integration cards and excludes the GitHub card', () => {
    render(<SettingsIntegrationsView initialIntegrations={[]} />);
    expect(screen.getByText('Google Gemini')).toBeInTheDocument();
    expect(screen.getByText('Slack')).toBeInTheDocument();
    // GitHub card must not appear on settings?tab=integrations
    expect(
      screen.queryByRole('heading', { name: 'GitHub' })
    ).not.toBeInTheDocument();
  });

  it('automatically opens detail dialog for workspace integration when autoOpenPopup is true', () => {
    render(
      <SettingsIntegrationsView
        initialIntegrations={[]}
        autoOpenPopup={true}
        autoOpenIntegration="alice-gemini"
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('Google Gemini')).toBeInTheDocument();
  });
});
