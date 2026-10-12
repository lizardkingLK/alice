import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BacklogWorkspace } from '@/app/backlog/_components/backlog-workspace';
import type { Sprint } from '@/app/sprints/_services/sprints.mutations.client';
import type { AppliedFilterBadgeItem } from '@/components/applied-filter-badges';
import { projectFactory } from '../factories/project.factory';
import { sprintFactory } from '../factories/sprint.factory';

vi.mock('@/components/optimistic-lock/optimistic-lock-provider', () => ({
  useOptimisticLock: () => ({ handleMutationError: vi.fn() }),
}));

vi.mock('@/app/backlog/_components/backlog-layout-menu', () => ({
  useBacklogLayout: () => ({
    preferredLayout: 'stack',
    effectiveLayout: 'stack',
    setPreferredLayout: vi.fn(),
  }),
}));

vi.mock('@/app/backlog/_components/backlog-toolbar', () => ({
  BacklogToolbar: ({
    sprints,
    onSprintFilterChange,
    appliedFilterItems,
  }: {
    sprints: readonly Sprint[];
    // eslint-disable-next-line no-unused-vars -- callback signature
    onSprintFilterChange: (value: string) => void;
    appliedFilterItems: readonly AppliedFilterBadgeItem[];
  }) => (
    <div>
      <div data-testid="sprint-filter-options">
        {sprints.map((sprint) => (
          <span key={sprint.id}>{sprint.name}</span>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onSprintFilterChange(sprints[0]?.id ?? '')}
      >
        Filter first sprint
      </button>
      <div data-testid="active-filter-badges">
        {appliedFilterItems.map((item) => (
          <span key={item.id}>{item.label}</span>
        ))}
      </div>
    </div>
  ),
}));

vi.mock('@/app/backlog/_components/backlog-sprint-card', () => ({
  BacklogSprintCard: ({
    sprint,
    onEditSprint,
  }: {
    sprint: Sprint;
    // eslint-disable-next-line no-unused-vars -- callback signature
    onEditSprint: (sprint: Sprint) => void;
  }) => (
    <article data-testid={`sprint-card-${sprint.id}`}>
      <span>{sprint.name}</span>
      <span data-testid={`sprint-details-${sprint.id}`}>
        {sprint.startDate}|{sprint.endDate}
      </span>
      <button type="button" onClick={() => onEditSprint(sprint)}>
        Edit {sprint.name}
      </button>
    </article>
  ),
}));

vi.mock('@/app/backlog/_components/backlog-panel', () => ({
  BacklogPanel: () => null,
}));

vi.mock('@/app/backlog/_components/backlog-item-details-sheet', () => ({
  BacklogItemDetailsSheet: ({ sprints }: { sprints: readonly Sprint[] }) => (
    <div data-testid="work-item-sprint-options">
      {sprints.map((sprint) => (
        <span key={sprint.id}>{sprint.name}</span>
      ))}
    </div>
  ),
}));

vi.mock('@/app/backlog/_components/backlog-dialogs', () => ({
  BacklogCreateSprintDialog: () => null,
  BacklogCreateIssueDialog: () => null,
  BacklogStartSprintDialog: () => null,
  BacklogCompleteSprintDialog: () => null,
  BacklogMismatchDialog: () => null,
  BacklogErrorDialog: () => null,
  BacklogEditSprintDialog: ({
    sprint,
    onClose,
    onUpdated,
  }: {
    sprint: Sprint | null;
    onClose: () => void;
    // eslint-disable-next-line no-unused-vars -- callback signature
    onUpdated: (sprint: Sprint) => void;
  }) =>
    sprint ? (
      <div data-testid="edit-sprint-dialog">
        <span>{sprint.name}</span>
        <button
          type="button"
          onClick={() =>
            onUpdated({
              ...sprint,
              name: 'Renamed Sprint',
              startDate: '2026-08-01',
              endDate: '2026-08-14',
              updatedAt: '2026-08-01T12:00:00.000Z',
            })
          }
        >
          Apply sprint update
        </button>
        <button type="button" onClick={onClose}>
          Cancel edit
        </button>
      </div>
    ) : null,
}));

vi.mock('@/app/sprints/_helpers/update-sprint-status-with-lock', () => ({
  updateSprintStatusWithOptimisticLock: vi.fn(),
}));

vi.mock('@/app/work-items/_services/work-items.mutations.client', () => ({
  updateWorkItem: vi.fn(),
}));

vi.mock('@repo/ui/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: ReactNode }) => children,
}));

const project = projectFactory.build();
const firstSprint = sprintFactory.build({ id: 'sprint-1', name: 'Sprint One' });
const secondSprint = sprintFactory.build({
  id: 'sprint-2',
  name: 'Sprint Two',
});

function renderWorkspace() {
  return render(
    <BacklogWorkspace
      projects={[project]}
      projectMembers={[]}
      teamCapacities={[]}
      initialWorkItems={[]}
      sprints={[firstSprint, secondSprint]}
      userRole="manager"
      currentUserId={null}
    />
  );
}

describe('BacklogWorkspace sprint editing synchronization', () => {
  it('replaces only the edited sprint and updates every sprint data consumer', async () => {
    renderWorkspace();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Sprint One' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Apply sprint update' })
    );

    await waitFor(() => {
      expect(screen.getByTestId('sprint-card-sprint-1')).toHaveTextContent(
        'Renamed Sprint'
      );
    });

    expect(screen.queryByTestId('edit-sprint-dialog')).not.toBeInTheDocument();
    expect(screen.getAllByTestId(/^sprint-card-/)).toHaveLength(2);
    expect(screen.getByTestId('sprint-card-sprint-2')).toHaveTextContent(
      'Sprint Two'
    );
    expect(screen.queryByText('Sprint One')).not.toBeInTheDocument();

    expect(screen.getByTestId('sprint-details-sprint-1')).toHaveTextContent(
      '2026-08-01|2026-08-14'
    );
    expect(
      within(screen.getByTestId('sprint-filter-options')).getByText(
        'Renamed Sprint'
      )
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('work-item-sprint-options')).getByText(
        'Renamed Sprint'
      )
    ).toBeInTheDocument();
  });

  it('updates the active sprint filter badge after a rename', async () => {
    renderWorkspace();

    fireEvent.click(
      screen.getByRole('button', { name: 'Filter first sprint' })
    );
    expect(screen.getByTestId('active-filter-badges')).toHaveTextContent(
      'Sprint One'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit Sprint One' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Apply sprint update' })
    );

    await waitFor(() => {
      expect(screen.getByTestId('active-filter-badges')).toHaveTextContent(
        'Renamed Sprint'
      );
    });
    expect(screen.getAllByTestId(/^sprint-card-/)).toHaveLength(1);
    expect(screen.getByTestId('sprint-card-sprint-1')).toHaveTextContent(
      'Renamed Sprint'
    );
  });
});
