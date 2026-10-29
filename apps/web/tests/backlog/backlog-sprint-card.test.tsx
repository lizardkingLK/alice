import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BacklogSprintCard } from '@/app/backlog/_components/backlog-sprint-card';
import type { Sprint } from '@/app/sprints/_services/sprints.mutations.client';
import { sprintFactory } from '../factories/sprint.factory';

vi.mock(
  '@repo/ui/components/ui/dropdown-menu',
  () => import('../mocks/dropdown-menu')
);

vi.mock('@repo/ui/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => children,
  TooltipTrigger: ({ children }: { children: ReactNode }) => children,
  TooltipContent: ({ children }: { children: ReactNode }) => (
    <span>{children}</span>
  ),
}));

vi.mock('@/app/backlog/_components/backlog-drop-zone', () => ({
  BacklogDropZone: () => <div data-testid="backlog-drop-zone" />,
}));

vi.mock('@/app/backlog/_components/backlog-item-count', () => ({
  BacklogItemCount: ({ count }: { count: number }) => <span>{count}</span>,
}));

vi.mock('@/app/backlog/_components/backlog-sprint-capacity-popover', () => ({
  BacklogSprintCapacityPopover: () => null,
}));

vi.mock('@/app/backlog/_components/backlog-sprint-details-popover', () => ({
  BacklogSprintDetailsPopover: ({ sprint }: { sprint: Sprint }) => (
    <span data-testid="sprint-details">
      {sprint.name}|{sprint.startDate}|{sprint.endDate}
    </span>
  ),
}));

function renderSprintCard(options?: {
  readonly sprint?: Sprint;
  readonly isManagerOrAdmin?: boolean;
  // eslint-disable-next-line no-unused-vars -- callback signature
  readonly onEditSprint?: (sprint: Sprint) => void;
  // eslint-disable-next-line no-unused-vars -- callback signature
  readonly onEstimateSprint?: (sprint: Sprint) => void;
  // eslint-disable-next-line no-unused-vars -- callback signature
  readonly onToggle?: (sprintId: string) => void;
}) {
  const sprint = options?.sprint ?? sprintFactory.build();
  const onEditSprint = options?.onEditSprint ?? vi.fn();
  const onEstimateSprint = options?.onEstimateSprint ?? vi.fn();
  const onToggle = options?.onToggle ?? vi.fn();

  const view = render(
    <BacklogSprintCard
      sprint={sprint}
      items={[]}
      issueCount={0}
      isCollapsed={false}
      isDragOver={false}
      isManagerOrAdmin={options?.isManagerOrAdmin ?? true}
      projects={[]}
      projectMembers={[]}
      teamCapacities={[]}
      onToggle={onToggle}
      onCreateIssue={vi.fn()}
      onEditSprint={onEditSprint}
      onEstimateSprint={onEstimateSprint}
      onStartSprint={vi.fn()}
      onCompleteSprint={vi.fn()}
      onSelectItem={vi.fn()}
      onItemDragStart={vi.fn()}
      onDragOver={vi.fn()}
      onDragLeave={vi.fn()}
      onDrop={vi.fn()}
    />
  );

  return { ...view, sprint, onEditSprint, onEstimateSprint, onToggle };
}

describe('BacklogSprintCard sprint actions', () => {
  it.each(['planned', 'active', 'closed'] as const)(
    'offers estimation for manager/admin %s sprints',
    (status) => {
      renderSprintCard({ sprint: sprintFactory.build({ status }) });

      expect(
        screen.getByRole('button', { name: 'Estimate with AI' })
      ).toBeInTheDocument();
    }
  );

  it('shows Estimate with AI to managers and admins and passes the sprint', () => {
    const { sprint, onEstimateSprint } = renderSprintCard();

    fireEvent.click(screen.getByRole('button', { name: 'Estimate with AI' }));

    expect(onEstimateSprint).toHaveBeenCalledWith(sprint);
  });

  it('shows Edit Sprint to managers and admins and passes the selected sprint', () => {
    const { sprint, onEditSprint } = renderSprintCard();

    expect(
      screen.getByRole('button', { name: 'Open Actions Menu' })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Sprint' }));

    expect(onEditSprint).toHaveBeenCalledWith(sprint);
  });

  it('does not show the actions menu to members', () => {
    renderSprintCard({ isManagerOrAdmin: false });

    expect(
      screen.queryByRole('button', { name: 'Open Actions Menu' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Edit Sprint' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Estimate with AI' })
    ).not.toBeInTheDocument();
  });

  it('does not collapse the sprint when opening the menu or selecting Edit', () => {
    const { onToggle } = renderSprintCard();

    fireEvent.click(screen.getByRole('button', { name: 'Open Actions Menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Estimate with AI' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit Sprint' }));

    expect(onToggle).not.toHaveBeenCalled();
  });

  it('passes updated sprint details to the details popover', () => {
    const sprint = sprintFactory.build();
    const { rerender } = renderSprintCard({ sprint });

    const updatedSprint = {
      ...sprint,
      name: 'Renamed Sprint',
      startDate: '2026-08-01',
      endDate: '2026-08-14',
    };

    rerender(
      <BacklogSprintCard
        sprint={updatedSprint}
        items={[]}
        issueCount={0}
        isCollapsed={false}
        isDragOver={false}
        isManagerOrAdmin
        projects={[]}
        projectMembers={[]}
        teamCapacities={[]}
        onToggle={vi.fn()}
        onCreateIssue={vi.fn()}
        onEditSprint={vi.fn()}
        onEstimateSprint={vi.fn()}
        onStartSprint={vi.fn()}
        onCompleteSprint={vi.fn()}
        onSelectItem={vi.fn()}
        onItemDragStart={vi.fn()}
        onDragOver={vi.fn()}
        onDragLeave={vi.fn()}
        onDrop={vi.fn()}
      />
    );

    expect(screen.getByTestId('sprint-details')).toHaveTextContent(
      'Renamed Sprint|2026-08-01|2026-08-14'
    );
  });
});
