import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WorkItemLinkSubtaskDialog } from '@/app/work-items/_components/work-item-link-subtask-dialog';
import { updateWorkItem } from '@/app/work-items/_services/workItem.service.client';
import { workItemFactory } from '../factories/workItem.factory';

vi.mock('@/app/work-items/_services/workItem.service.client', () => ({
  updateWorkItem: vi.fn(),
}));

vi.mock('@/app/_shared/utility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/_shared/utility')>();
  return {
    ...actual,
    delay: vi.fn(() => Promise.resolve()),
  };
});

vi.mock('@repo/ui/components/ui/sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('WorkItemLinkSubtaskDialog', () => {
  const parentId = 'parent-story-1';
  const candidates = [
    workItemFactory.build({
      id: 'orphan-task-1',
      title: 'Orphan task one',
      type: 'Task',
      parent_id: null,
    }),
    workItemFactory.build({
      id: 'orphan-task-2',
      title: 'Orphan task two',
      type: 'Task',
      parent_id: null,
    }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('PATCHes selected child with parent_id on Link', async () => {
    // Arrange
    const onLinked = vi.fn();
    const onOpenChange = vi.fn();
    vi.mocked(updateWorkItem).mockResolvedValue({
      data: workItemFactory.build({
        id: candidates[0]!.id,
        parent_id: parentId,
      }),
      error: null,
    });

    render(
      <WorkItemLinkSubtaskDialog
        open
        onOpenChange={onOpenChange}
        parentWorkItemId={parentId}
        parentType="Story"
        childType="Task"
        candidates={candidates}
        onLinked={onLinked}
      />
    );

    // Act
    fireEvent.click(screen.getByLabelText(/^Task$/i));
    fireEvent.click(screen.getByRole('option', { name: /Orphan task one/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Link$/i }));

    // Assert
    await waitFor(() => {
      expect(updateWorkItem).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(updateWorkItem).mock.calls[0]![0]).toBe(candidates[0]!.id);
    const formData = vi.mocked(updateWorkItem).mock.calls[0]![1] as FormData;
    expect(formData.get('parent_id')).toBe(parentId);
    await waitFor(() => {
      expect(onLinked).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('shows empty state when there are no candidates', () => {
    // Arrange
    render(
      <WorkItemLinkSubtaskDialog
        open
        onOpenChange={vi.fn()}
        parentWorkItemId={parentId}
        parentType="Story"
        childType="Task"
        candidates={[]}
        onLinked={vi.fn()}
      />
    );

    // Assert
    expect(
      screen.getByText(/No unparented Task items in this project to link/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Link$/i })).toBeDisabled();
  });
});
