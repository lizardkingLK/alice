import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BurndownScopeLabels } from '@/components/burndown-scope-labels';

describe('BurndownScopeLabels', () => {
  it('renders project and sprint names', () => {
    render(<BurndownScopeLabels projectName="HAVIT2" sprintName="Sprint 12" />);

    expect(
      screen.getByRole('group', {
        name: 'Widget scope: HAVIT2: Sprint 12',
      })
    ).toBeInTheDocument();
    expect(screen.getByText('HAVIT2')).toBeInTheDocument();
    expect(screen.getByText('Sprint 12')).toBeInTheDocument();
  });

  it('renders nothing when both names are empty', () => {
    const { container } = render(
      <BurndownScopeLabels projectName={null} sprintName="  " />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
