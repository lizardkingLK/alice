import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { WorkItemFormDialog } from '@/app/work-items/_components/work-item-form/work-item-form-dialog';
import { getWorkItemById } from '@/app/work-items/_services/work-items.reads.client';
import { workItemFactory } from '../factories/workItem.factory';
import { projectFactory } from '../factories/project.factory';
import { userFactory } from '../factories/user.factory';

vi.mock('@/app/work-items/_services/work-items.reads.client', () => ({
  getWorkItemById: vi.fn(),
  listParentCandidateWorkItems: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/app/work-items/_hooks/use-work-item-create-form-mode', () => ({
  useWorkItemCreateFormMode: () => 'classic' as const,
}));

vi.mock('@/app/work-items/_components/work-item-form/work-item-form', () => ({
  WorkItemForm: ({
    itemToEdit,
  }: {
    itemToEdit?: { description?: unknown } | null;
  }) => (
    <div data-testid="mock-work-item-form">
      {itemToEdit?.description == null
        ? 'no-description'
        : JSON.stringify(itemToEdit.description)}
    </div>
  ),
}));

describe('WorkItemFormDialog', () => {
  const projectMembers = userFactory.buildList(1);
  const projects = projectFactory.buildList(1);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads full work item detail so description is available for edit', async () => {
    const compactRow = workItemFactory.build({
      id: 'wi-1',
      title: 'Configure build and dev scripts',
    });
    // Simulate chart/list row without description key.
    const withoutDescription = { ...compactRow };
    delete withoutDescription.description;

    const fullItem = workItemFactory.build({
      id: 'wi-1',
      title: 'Configure build and dev scripts',
      description: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'new one' }],
          },
        ],
      },
    });
    vi.mocked(getWorkItemById).mockResolvedValue(fullItem);

    render(
      <WorkItemFormDialog
        open
        onOpenChange={vi.fn()}
        title="Edit Work Item"
        description="Update the details for this work item."
        projects={projects}
        projectMembers={projectMembers}
        itemToEdit={withoutDescription as typeof compactRow}
        onSuccess={vi.fn()}
      />
    );

    expect(screen.getByText(/Loading work item/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(getWorkItemById).toHaveBeenCalledWith('wi-1');
    });

    await waitFor(() => {
      expect(screen.getByTestId('mock-work-item-form')).toHaveTextContent(
        'new one'
      );
    });
  });
});
