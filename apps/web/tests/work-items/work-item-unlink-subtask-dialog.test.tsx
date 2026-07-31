import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WorkItemUnlinkSubtaskDialog } from '@/app/work-items/_components/work-item-unlink-subtask-dialog';
import { updateWorkItem } from '@/app/work-items/_services/workItem.service.client';

vi.mock('@/app/work-items/_services/workItem.service.client', () => ({
  updateWorkItem: vi.fn(),
}));

vi.mock('@repo/ui/components/ui/sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('WorkItemUnlinkSubtaskDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears parent_id on confirm and calls onUnlinked', async () => {
    // Arrange
    const onUnlinked = vi.fn();
    const onOpenChange = vi.fn();
    vi.mocked(updateWorkItem).mockResolvedValue({
      data: null,
      error: null,
    });

    render(
      <WorkItemUnlinkSubtaskDialog
        open
        onOpenChange={onOpenChange}
        childId="child-1"
        childTitle="Orphan candidate"
        childType="Task"
        parentType="Story"
        onUnlinked={onUnlinked}
      />
    );

    // Act
    fireEvent.click(screen.getByRole('button', { name: /^Unlink$/i }));

    // Assert
    await waitFor(() => {
      expect(updateWorkItem).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(updateWorkItem).mock.calls[0]![0]).toBe('child-1');
    const formData = vi.mocked(updateWorkItem).mock.calls[0]![1] as FormData;
    expect(formData.get('parent_id')).toBe('');
    await waitFor(() => {
      expect(onUnlinked).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('does not unlink when Cancel is clicked', () => {
    // Arrange
    const onUnlinked = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <WorkItemUnlinkSubtaskDialog
        open
        onOpenChange={onOpenChange}
        childId="child-1"
        childTitle="Keep linked"
        childType="Task"
        parentType="Story"
        onUnlinked={onUnlinked}
      />
    );

    // Act
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

    // Assert
    expect(updateWorkItem).not.toHaveBeenCalled();
    expect(onUnlinked).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
