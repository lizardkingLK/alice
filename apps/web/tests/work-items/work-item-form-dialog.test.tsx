import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { WorkItemFormDialog } from '@/app/work-items/_components/work-item-form/work-item-form-dialog';
import { getWorkItemById } from '@/app/work-items/_services/work-items.reads.client';
import {
  fetchProjectMembersForForm,
  fetchProjectSprintsForForm,
} from '@/lib/form-read-actions';
import { workItemFactory } from '../factories/workItem.factory';
import { projectFactory } from '../factories/project.factory';
import { userFactory } from '../factories/user.factory';

vi.mock('@/app/work-items/_services/work-items.reads.client', () => ({
  getWorkItemById: vi.fn(),
  listParentCandidateWorkItems: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/form-read-actions', () => ({
  fetchProjectSprintsForForm: vi.fn().mockResolvedValue([]),
  fetchProjectMembersForForm: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/app/work-items/_hooks/use-work-item-create-form-mode', () => ({
  useWorkItemCreateFormMode: () => 'classic' as const,
}));

vi.mock('@/app/work-items/_components/work-item-form/work-item-form', () => ({
  WorkItemForm: ({
    itemToEdit,
    projectSprints,
    preferProvidedSprints,
  }: {
    itemToEdit?: { description?: unknown } | null;
    projectSprints?: readonly { id: string; name: string }[];
    preferProvidedSprints?: boolean;
  }) => (
    <div data-testid="mock-work-item-form">
      <span data-testid="form-description">
        {itemToEdit?.description == null
          ? 'no-description'
          : JSON.stringify(itemToEdit.description)}
      </span>
      <span data-testid="form-sprint-count">{projectSprints?.length ?? 0}</span>
      <span data-testid="form-prefer-sprints">
        {String(Boolean(preferProvidedSprints))}
      </span>
    </div>
  ),
}));

describe('WorkItemFormDialog', () => {
  const projectMembers = userFactory.buildList(1);
  const projects = projectFactory.buildList(1);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchProjectSprintsForForm).mockResolvedValue([]);
    vi.mocked(fetchProjectMembersForForm).mockResolvedValue([]);
  });

  it('opens edit immediately and hydrates full detail in the background', async () => {
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

    expect(screen.queryByText(/Loading work item/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('mock-work-item-form')).toBeInTheDocument();

    await waitFor(() => {
      expect(getWorkItemById).toHaveBeenCalledWith('wi-1');
    });

    await waitFor(() => {
      expect(screen.getByTestId('form-description')).toHaveTextContent(
        'new one'
      );
    });

    expect(fetchProjectSprintsForForm).toHaveBeenCalledWith(
      withoutDescription.project_id
    );
    expect(fetchProjectMembersForForm).toHaveBeenCalledWith(
      withoutDescription.project_id
    );
    expect(screen.getByTestId('form-prefer-sprints')).toHaveTextContent('true');
  });

  it('prefers bootstrapped sprints once they resolve in the background', async () => {
    const compactRow = workItemFactory.build({ id: 'wi-2' });
    let resolveSprints!: (
      // eslint-disable-next-line no-unused-vars
      value: { id: string; name: string; status: string }[]
    ) => void;
    const sprintsPromise = new Promise<
      { id: string; name: string; status: string }[]
    >((resolve) => {
      resolveSprints = resolve;
    });

    vi.mocked(getWorkItemById).mockResolvedValue(compactRow);
    vi.mocked(fetchProjectSprintsForForm).mockReturnValue(
      sprintsPromise as ReturnType<typeof fetchProjectSprintsForForm>
    );
    vi.mocked(fetchProjectMembersForForm).mockResolvedValue([]);

    render(
      <WorkItemFormDialog
        open
        onOpenChange={vi.fn()}
        title="Edit Work Item"
        description="Update the details for this work item."
        projects={projects}
        projectMembers={projectMembers}
        itemToEdit={compactRow}
        onSuccess={vi.fn()}
      />
    );

    expect(screen.queryByText(/Loading work item/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('mock-work-item-form')).toBeInTheDocument();
    expect(screen.getByTestId('form-sprint-count')).toHaveTextContent('0');

    resolveSprints([{ id: 'sprint-1', name: 'Sprint 1', status: 'active' }]);

    await waitFor(() => {
      expect(screen.getByTestId('form-sprint-count')).toHaveTextContent('1');
    });
  });

  it('opens create immediately without a dialog-level bootstrap spinner', () => {
    render(
      <WorkItemFormDialog
        open
        onOpenChange={vi.fn()}
        title="Create Subtask"
        description="Create a Story under this Epic."
        projects={projects}
        projectMembers={projectMembers}
        lockProject
        parentId="parent-1"
        onSuccess={vi.fn()}
      />
    );

    expect(screen.queryByText(/^Loading…$/)).not.toBeInTheDocument();
    expect(screen.getByTestId('mock-work-item-form')).toBeInTheDocument();
    expect(getWorkItemById).not.toHaveBeenCalled();
    expect(fetchProjectSprintsForForm).not.toHaveBeenCalled();
    expect(fetchProjectMembersForForm).not.toHaveBeenCalled();
    expect(screen.getByTestId('form-prefer-sprints')).toHaveTextContent(
      'false'
    );
  });
});
