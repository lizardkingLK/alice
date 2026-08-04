import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProjectWorkspaceAccessDenied } from '@/app/projects/[id]/_components/project-workspace-access-denied';

describe('ProjectWorkspaceAccessDenied', () => {
  it('explains membership requirement and links back to projects', () => {
    render(
      <ProjectWorkspaceAccessDenied projectName="Alpha" projectKey="ALP" />
    );

    expect(screen.getByText('No access to this project')).toBeInTheDocument();
    expect(screen.getByText(/ALP · Alpha/)).toBeInTheDocument();
    expect(
      screen.getByText(/need to be a project member/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Back to projects/i })
    ).toHaveAttribute('href', '/projects');
  });
});
