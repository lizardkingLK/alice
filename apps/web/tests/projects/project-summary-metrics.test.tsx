import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProjectSummaryMetrics } from '@/app/projects/_components/project-details/project-summary-metrics';

describe('ProjectSummaryMetrics', () => {
  it('links metric cards to project tabs and hides Sprints for members', () => {
    const { rerender } = render(
      <ProjectSummaryMetrics
        projectId="project-1"
        memberCount={4}
        teamCount={0}
        workItemCount={20}
        sprintCount={3}
        integrationCount={1}
        fieldCount={2}
        isManagerOrAdmin
      />
    );

    expect(screen.getByRole('link', { name: /members/i })).toHaveAttribute(
      'href',
      '/projects/project-1?tab=members'
    );
    expect(screen.getByRole('link', { name: /teams/i })).toHaveAttribute(
      'href',
      '/projects/project-1?tab=teams'
    );
    expect(screen.getByRole('link', { name: /work items/i })).toHaveAttribute(
      'href',
      '/projects/project-1?tab=work-items'
    );
    expect(screen.getByRole('link', { name: /sprints/i })).toHaveAttribute(
      'href',
      '/projects/project-1?tab=sprints'
    );
    expect(screen.getByRole('link', { name: /integrations/i })).toHaveAttribute(
      'href',
      '/projects/project-1?tab=integrations'
    );
    expect(screen.getByRole('link', { name: /fields/i })).toHaveAttribute(
      'href',
      '/projects/project-1?tab=fields'
    );

    rerender(
      <ProjectSummaryMetrics
        projectId="project-1"
        memberCount={4}
        teamCount={0}
        workItemCount={20}
        sprintCount={3}
        integrationCount={1}
        fieldCount={2}
        isManagerOrAdmin={false}
      />
    );

    expect(
      screen.queryByRole('link', { name: /sprints/i })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /members/i })).toBeInTheDocument();
  });
});
