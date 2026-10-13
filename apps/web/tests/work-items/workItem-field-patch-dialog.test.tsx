import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  WORK_ITEM_PATCH_FIELD_CONFIG,
  WorkItemFieldPatchDialog,
} from '@/app/work-items/_components/work-item-details/work-item-field-patch-dialog';
import { updateWorkItem } from '@/app/work-items/_services/work-items.mutations.client';
import { workItemFactory } from '../factories/workItem.factory';

vi.mock('next/navigation', () => import('../mocks/next-navigation'));

vi.mock('@/app/_shared/utility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/_shared/utility')>();
  return {
    ...actual,
    delay: vi.fn(() => Promise.resolve()),
  };
});

vi.mock('@/app/work-items/_services/work-items.mutations.client', () => ({
  updateWorkItem: vi.fn(),
  updateWorkItemStatus: vi.fn(),
}));

vi.mock('@/components/optimistic-lock/optimistic-lock-provider', () => ({
  useOptimisticLock: () => ({ handleMutationError: vi.fn() }),
}));

describe('WorkItemFieldPatchDialog', () => {
  it('opens the status confirm without an update-depth loop', () => {
    render(
      <WorkItemFieldPatchDialog
        open
        onOpenChange={vi.fn()}
        workItemId="wi-1"
        expectedUpdatedAt="2026-06-01T00:00:00.000Z"
        fieldConfig={WORK_ITEM_PATCH_FIELD_CONFIG.status}
        currentValue="Done"
        onPatched={vi.fn()}
      />
    );

    expect(screen.getByText('Change Status')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveTextContent('Done');
  });

  it('patches due_date from the date field dialog', async () => {
    const onPatched = vi.fn();
    const onOpenChange = vi.fn();
    vi.mocked(updateWorkItem).mockResolvedValue({
      data: workItemFactory.build({
        due_date: '2026-09-15',
        updated_at: '2026-06-02T00:00:00.000Z',
      }),
      error: null,
    });

    render(
      <WorkItemFieldPatchDialog
        open
        onOpenChange={onOpenChange}
        workItemId="wi-1"
        expectedUpdatedAt="2026-06-01T00:00:00.000Z"
        fieldConfig={WORK_ITEM_PATCH_FIELD_CONFIG.due_date}
        currentValue="2026-08-01T00:00:00.000Z"
        onPatched={onPatched}
      />
    );

    const dueDateInput = screen.getByLabelText(/^Due date$/i);
    expect(dueDateInput).toHaveValue('2026-08-01');

    fireEvent.change(dueDateInput, { target: { value: '2026-09-15' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    await waitFor(() => {
      expect(updateWorkItem).toHaveBeenCalledTimes(1);
    });

    const formData = vi.mocked(updateWorkItem).mock.calls[0]![1] as FormData;
    expect(formData.get('due_date')).toBe('2026-09-15');

    await waitFor(() => {
      expect(onPatched).toHaveBeenCalledWith(
        expect.objectContaining({
          due_date: '2026-09-15',
          updated_at: '2026-06-02T00:00:00.000Z',
        })
      );
    });
  });
});
