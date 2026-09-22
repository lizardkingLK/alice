import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BoardGroupedColumnsView } from '@/app/board/_components/board-grouped-columns-view';
import { TooltipProvider } from '@repo/ui/components/ui/tooltip';

const columns = [
  { id: 'new', name: 'New', status: 'New' as const },
  { id: 'todo', name: 'To Do', status: 'ToDo' as const },
];

const item = {
  id: '22222222-2222-4222-8222-222222222222',
  project_id: '33333333-3333-4333-8333-333333333333',
  sprint_id: null,
  parent_id: null,
  title: 'Grouped row',
  type: 'Task' as const,
  priority: 'medium' as const,
  description: null,
  labels: [],
  assignee_id: null,
  reporter_id: null,
  due_date: null,
  story_points: null,
  status: 'New' as const,
  board_column_id: 'new',
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

describe('BoardGroupedColumnsView', () => {
  it('renders column groups and supports drop onto another group', () => {
    const onColumnDrop = vi.fn();
    const map = new Map([
      ['new', [item as never]],
      ['todo', [] as never[]],
    ]);

    render(
      <TooltipProvider>
        <BoardGroupedColumnsView
          boardColumns={columns}
          columnItemsMap={map}
          activeDropCol={null}
          draggedTaskId={null}
          pendingStatusIds={new Set()}
          onSelectItem={vi.fn()}
          onCreateInColumn={vi.fn()}
          onItemDragStart={vi.fn()}
          onItemDragEnd={vi.fn()}
          onColumnDragOver={vi.fn()}
          onColumnDragLeave={vi.fn()}
          onColumnDrop={onColumnDrop}
        />
      </TooltipProvider>
    );

    expect(screen.getByText('Grouped row')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /New, 1 item/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /To Do, 0 items/i })
    ).toBeInTheDocument();

    const todoGroup = screen
      .getByRole('button', { name: /To Do, 0 items/i })
      .closest('div.min-w-0');
    expect(todoGroup).toBeTruthy();
    fireEvent.drop(todoGroup!, {
      dataTransfer: { getData: () => item.id },
    });
    expect(onColumnDrop).toHaveBeenCalled();
  });

  it('dims rows while a status update is pending', () => {
    const map = new Map([['new', [item as never]]]);

    const { container } = render(
      <TooltipProvider>
        <BoardGroupedColumnsView
          boardColumns={columns}
          columnItemsMap={map}
          activeDropCol={null}
          draggedTaskId={null}
          pendingStatusIds={new Set([item.id])}
          onSelectItem={vi.fn()}
          onCreateInColumn={vi.fn()}
          onItemDragStart={vi.fn()}
          onItemDragEnd={vi.fn()}
          onColumnDragOver={vi.fn()}
          onColumnDragLeave={vi.fn()}
          onColumnDrop={vi.fn()}
        />
      </TooltipProvider>
    );

    const row = container.querySelector('tr.opacity-40');
    expect(row).toBeTruthy();
  });
});
