import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/api-fetch.helper';
import { BOARD_MOVE_FORBIDDEN_CODE } from '@repo/types/api/v1';
import { updateWorkItemStatus } from '@/app/work-items/_services/work-items.mutations.client';
import { toast } from '@repo/ui/components/ui/sonner';
import { KanbanBoard } from '@/app/board/_components/kanban-board';
import { TooltipProvider } from '@repo/ui/components/ui/tooltip';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/board',
  useSearchParams: () => new URLSearchParams('project=project-1'),
}));
vi.mock('@/components/realtime/realtime-provider', () => ({
  useRealtime: () => ({ isUserOnline: () => false }),
}));
vi.mock('@/components/optimistic-lock/optimistic-lock-provider', () => ({
  useOptimisticLock: () => ({ handleMutationError: vi.fn() }),
}));
vi.mock('@/app/board/_hooks/use-board-defaults-bootstrap', () => ({
  useBoardDefaultsBootstrap: () => ({
    savedDefaultsApplied: false,
    urlFiltersActive: false,
    openDefaultsDialog: vi.fn(),
    resetUrlFilters: vi.fn(),
  }),
}));
vi.mock('@/app/board/_components/workspace-defaults-dialog-host', () => ({
  pickWorkspaceDefaultsDialogController: () => ({}),
  WorkspaceDefaultsDialogHost: () => null,
}));
vi.mock('@/app/board/_components/workspace-defaults-controls', () => ({
  WorkspaceDefaultsControls: () => null,
}));
vi.mock(
  '@/app/work-items/_components/work-item-registry/work-items-filter-dialog',
  () => ({
    WorkItemsFilterDialog: () => null,
  })
);
vi.mock(
  '@/app/work-items/_components/work-item-form/work-item-form-dialog',
  () => ({
    WorkItemFormDialog: () => null,
  })
);
vi.mock(
  '@/app/work-items/_components/work-item-description/work-item-description-view',
  () => ({
    DescriptionView: () => null,
  })
);
vi.mock('@/app/work-items/_services/work-items.mutations.client', () => ({
  updateWorkItemStatus: vi.fn(),
}));
vi.mock('@repo/ui/components/ui/sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const columns = [
  { id: 'new', name: 'New', status: 'New' as const },
  { id: 'todo', name: 'To Do', status: 'ToDo' as const },
  { id: 'development', name: 'Development', status: 'InProgress' as const },
  { id: 'code-review', name: 'Code Review', status: 'InProgress' as const },
  { id: 'testing', name: 'Testing', status: 'Testing' as const },
  { id: 'done', name: 'Done', status: 'Done' as const },
];

const item = {
  id: '22222222-2222-4222-8222-222222222222',
  project_id: '33333333-3333-4333-8333-333333333333',
  sprint_id: null,
  parent_id: null,
  title: 'Restricted move',
  type: 'Task' as const,
  priority: 'medium' as const,
  description: null,
  labels: [],
  assignee_id: null,
  reporter_id: null,
  due_date: null,
  story_points: null,
  status: 'InProgress' as const,
  board_column_id: 'development',
  record_status: 'active' as const,
  done_at: null,
  created_by: null,
  created_at: '2026-09-10T00:00:00.000Z',
  updated_by: null,
  updated_at: '2026-09-10T00:00:00.000Z',
  jira_issue_key: null,
  assignee: null,
  reporter: null,
};

describe('Kanban board policy denial', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rolls back an optimistic move and shows a safe toast on policy 403', async () => {
    vi.mocked(updateWorkItemStatus).mockRejectedValue(
      new ApiError('Forbidden', 403, { code: BOARD_MOVE_FORBIDDEN_CODE })
    );

    render(
      <TooltipProvider>
        <KanbanBoard
          boardColumns={columns}
          usesCustomBoardConfig
          initialWorkItems={[item] as never}
          projects={[]}
          sprints={[]}
          projectFilter="project-1"
          sprintFilter=""
          allowAllFilters
          userId="actor-1"
          suggestedDefaults={null}
          needsClientBootstrap={false}
        />
      </TooltipProvider>
    );

    fireEvent.click(
      within(screen.getByRole('region', { name: 'Development' })).getByText(
        'Restricted move'
      )
    );
    fireEvent.click(screen.getByRole('button', { name: 'Code Review' }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Move blocked: you do not have permission to move this item from Development to Code Review.'
      )
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[0]!);

    expect(
      within(screen.getByRole('region', { name: 'Development' })).getByText(
        'Restricted move'
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        'You do not have permission to perform this board movement.'
      )
    ).not.toBeInTheDocument();
  });
});
