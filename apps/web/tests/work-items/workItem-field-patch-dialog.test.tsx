import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  WORK_ITEM_PATCH_FIELD_CONFIG,
  WorkItemFieldPatchDialog,
} from '@/app/work-items/_components/workItem-field-patch-dialog';

vi.mock('@/app/work-items/_services/workItem.service.client', () => ({
  updateWorkItem: vi.fn(),
  updateWorkItemStatus: vi.fn(),
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
});
