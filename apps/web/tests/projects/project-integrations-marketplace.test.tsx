import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ProjectIntegrationsMarketplace } from '@/app/projects/_components/project-details/project-integrations-marketplace';
import { projectFactory } from '../factories/project.factory';

vi.mock(
  '@/app/projects/_components/project-details/project-integrations-summary-bar',
  () => ({
    ProjectIntegrationsSummaryBar: () => (
      <div data-testid="integrations-summary-bar">Summary</div>
    ),
  })
);

vi.mock(
  '@/app/projects/_components/project-details/github-settings-card',
  () => ({
    GithubSettingsCard: () => (
      <div data-testid="github-settings-card">GitHub card</div>
    ),
  })
);

vi.mock(
  '@/app/projects/_components/project-details/jira-settings-card',
  () => ({
    JiraSettingsCard: () => (
      <div data-testid="jira-settings-card">Jira card</div>
    ),
  })
);

vi.mock(
  '@/app/projects/_components/project-details/project-ai-models-card',
  () => ({
    ProjectAiModelsCard: () => (
      <div data-testid="ai-models-card">AI models card</div>
    ),
  })
);

describe('ProjectIntegrationsMarketplace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders marketplace chrome with SC/PM radios defaulting to None', () => {
    // Arrange
    const project = projectFactory.build();

    // Act
    render(<ProjectIntegrationsMarketplace project={project} />);

    // Assert
    expect(screen.getByTestId('integrations-summary-bar')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Project integrations' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('searchbox', { name: /Search project integrations/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: 'Source control' })
    ).toBeInTheDocument();
    const noneRadios = screen.getAllByRole('radio', { name: /^None$/i });
    expect(noneRadios).toHaveLength(2);
    for (const radio of noneRadios) {
      expect(radio).toBeChecked();
    }
    expect(screen.getByRole('radio', { name: /^GitHub$/i })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: /^Jira$/i })).not.toBeChecked();
    expect(
      screen.queryByTestId('github-settings-card')
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('jira-settings-card')).not.toBeInTheDocument();
    expect(screen.getByTestId('ai-models-card')).toBeInTheDocument();
  });

  it('selects GitHub radio and shows the GitHub settings card', () => {
    // Arrange
    const project = projectFactory.build();
    render(<ProjectIntegrationsMarketplace project={project} />);

    // Act
    fireEvent.click(screen.getByRole('radio', { name: /^GitHub$/i }));

    // Assert
    expect(screen.getByRole('radio', { name: /^GitHub$/i })).toBeChecked();
    expect(screen.getByTestId('github-settings-card')).toBeInTheDocument();
  });

  it('keeps GitHub selected when linked and None is clicked', () => {
    // Arrange
    const project = projectFactory.build({
      github_repo: 'acme/apollo',
      github_connection_id: 'vc-1',
    });
    render(<ProjectIntegrationsMarketplace project={project} />);

    // Assert initial
    expect(screen.getByRole('radio', { name: /^GitHub$/i })).toBeChecked();
    expect(screen.getByTestId('github-settings-card')).toBeInTheDocument();

    // Act — attempt to clear while linked
    const noneRadios = screen.getAllByRole('radio', { name: /^None$/i });
    fireEvent.click(noneRadios[0]!);

    // Assert
    expect(screen.getByRole('radio', { name: /^GitHub$/i })).toBeChecked();
    expect(screen.getByTestId('github-settings-card')).toBeInTheDocument();
  });

  it('hides SC/PM panels when searching for AI agents', () => {
    // Arrange
    const project = projectFactory.build({
      github_repo: 'acme/apollo',
      jira_project_key: 'TEST',
      jira_connection_id: 'jira-1',
    });
    render(<ProjectIntegrationsMarketplace project={project} />);
    expect(screen.getByTestId('github-settings-card')).toBeInTheDocument();
    expect(screen.getByTestId('jira-settings-card')).toBeInTheDocument();

    // Act
    fireEvent.change(
      screen.getByRole('searchbox', { name: /Search project integrations/i }),
      { target: { value: 'ai agents' } }
    );

    // Assert
    expect(screen.getByTestId('ai-models-card')).toBeInTheDocument();
    expect(
      screen.queryByTestId('github-settings-card')
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('jira-settings-card')).not.toBeInTheDocument();
  });
});
