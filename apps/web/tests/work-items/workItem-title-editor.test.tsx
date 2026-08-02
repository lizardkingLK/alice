import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkItemTitleEditor } from '@/app/work-items/_components/workItem-title-editor';

vi.mock('@/app/work-items/_components/workItem-field-patch-dialog', () => ({
  WORK_ITEM_PATCH_FIELD_CONFIG: {
    title: {
      field: 'title',
      kind: 'text',
      title: 'Edit Title',
      description: 'Update the work item title.',
      label: 'Title',
    },
  },
  WorkItemFieldPatchDialog: () => null,
}));

describe('WorkItemTitleEditor', () => {
  it('shows the edit control when not read-only', () => {
    render(
      <WorkItemTitleEditor
        workItemId="wi-1"
        title="Editable title"
        expectedUpdatedAt="2024-01-01T00:00:00.000Z"
        onPatched={vi.fn()}
      />
    );

    expect(
      screen.getByRole('button', { name: /Edit title/i })
    ).toBeInTheDocument();
  });

  it('hides the edit control when read-only', () => {
    render(
      <WorkItemTitleEditor
        workItemId="wi-1"
        title="Done title"
        expectedUpdatedAt="2024-01-01T00:00:00.000Z"
        onPatched={vi.fn()}
        readOnly
      />
    );

    expect(
      screen.queryByRole('button', { name: /Edit title/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Done title' })
    ).toBeInTheDocument();
  });
});
