import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkspaceDefaultsControls } from '@/app/board/_components/workspace-defaults-controls';

describe('WorkspaceDefaultsControls', () => {
  it('highlights and summarizes saved defaults only when they are applied', () => {
    render(
      <WorkspaceDefaultsControls
        onOpenDefaultsDialog={vi.fn()}
        savedDefaultsApplied
        appliedDefaultsSummary={{
          projectName: 'Alice',
          sprintName: 'Sprint 1',
        }}
      />
    );

    expect(
      screen.getByRole('button', { name: /Defaults applied/i })
    ).toHaveClass('border-primary');
    expect(document.querySelector('.animate-ping')).not.toBeInTheDocument();
  });

  it('does not highlight when current filters override defaults', () => {
    render(
      <WorkspaceDefaultsControls
        onOpenDefaultsDialog={vi.fn()}
        savedDefaultsApplied={false}
        appliedDefaultsSummary={{
          projectName: 'Alice',
          sprintName: 'Sprint 1',
        }}
      />
    );

    const button = screen.getByRole('button', {
      name: /Open workspace defaults/i,
    });
    expect(button).not.toHaveClass('border-primary');
    expect(document.querySelector('.animate-ping')).not.toBeInTheDocument();
  });
});
