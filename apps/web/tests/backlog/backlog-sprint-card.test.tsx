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
    <span>{sprint.name}</span>
  ),
}));

function renderSprintCard(options?: {
  readonly isManagerOrAdmin?: boolean;
  // eslint-disable-next-line no-unused-vars -- callback signature
  readonly onEditSprint?: (sprint: Sprint) => void;
  // eslint-disable-next-line no-unused-vars -- callback signature
  readonly onToggle?: (sprintId: string) => void;
}) {
  const sprint = sprintFactory.build();
  const onEditSprint = options?.onEditSprint ?? vi.fn();
  const onToggle = options?.onToggle ?? vi.fn();

  render(
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
      onStartSprint={vi.fn()}
      onCompleteSprint={vi.fn()}
      onSelectItem={vi.fn()}
      onItemDragStart={vi.fn()}
      onDragOver={vi.fn()}
      onDragLeave={vi.fn()}
      onDrop={vi.fn()}
    />
  );

  return { sprint, onEditSprint, onToggle };
}

describe('BacklogSprintCard sprint actions', () => {
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
  });

  it('does not collapse the sprint when opening the menu or selecting Edit', () => {
    const { onToggle } = renderSprintCard();

    fireEvent.click(screen.getByRole('button', { name: 'Open Actions Menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit Sprint' }));

    expect(onToggle).not.toHaveBeenCalled();
  });
});
