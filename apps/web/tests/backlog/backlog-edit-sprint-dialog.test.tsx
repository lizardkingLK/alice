import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BacklogEditSprintDialog } from '@/app/backlog/_components/backlog-dialogs';
import { updateSprint } from '@/app/sprints/_services/sprints.mutations.client';
import { projectFactory } from '../factories/project.factory';
import { sprintFactory } from '../factories/sprint.factory';

vi.mock('@/app/sprints/_services/sprints.mutations.client', () => ({
  createSprint: vi.fn(),
  updateSprint: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => {
    const result = Promise.resolve({ count: 0, error: null });
    const query = {
      eq: () => query,
      then: result.then.bind(result),
    };
    return {
      from: () => ({ select: () => query }),
    };
  },
}));

const project = projectFactory.build();
const sprint = sprintFactory.build();

function renderDialog(options?: {
  readonly selectedSprint?: typeof sprint | null;
  readonly onClose?: () => void;
  // eslint-disable-next-line no-unused-vars -- callback signature
  readonly onUpdated?: (updated: typeof sprint) => void;
}) {
  const onClose = options?.onClose ?? vi.fn();
  const onUpdated = options?.onUpdated ?? vi.fn();

  render(
    <BacklogEditSprintDialog
      sprint={
        options?.selectedSprint === undefined ? sprint : options.selectedSprint
      }
      projects={[project]}
      currentUserId="user-1"
      onClose={onClose}
      onUpdated={onUpdated}
    />
  );

  return { onClose, onUpdated };
}

describe('BacklogEditSprintDialog', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('opens with the selected sprint values and locks its project', () => {
    renderDialog();

    expect(screen.getByText('Edit Sprint')).toBeInTheDocument();
    expect(screen.getByLabelText('Sprint name')).toHaveValue(sprint.name);
    expect(screen.getByLabelText('Goal')).toHaveValue(sprint.goal);
    expect(screen.getByLabelText('Start date')).toHaveValue(sprint.startDate);
    expect(screen.getByLabelText('End date')).toHaveValue(sprint.endDate);
    expect(screen.getByLabelText('Project')).toBeDisabled();
  });

  it('does not render without a selected sprint', () => {
    renderDialog({ selectedSprint: null });

    expect(screen.queryByText('Edit Sprint')).not.toBeInTheDocument();
  });

  it('closes without saving when Cancel is selected', () => {
    const { onClose } = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(updateSprint).not.toHaveBeenCalled();
  });

  it('closes without saving from the close button', () => {
    const { onClose } = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(updateSprint).not.toHaveBeenCalled();
  });

  it('updates the sprint with its original project and returns the response', async () => {
    const updatedSprint = { ...sprint, name: 'Updated Sprint' };
    vi.mocked(updateSprint).mockResolvedValue(updatedSprint);
    const { onUpdated } = renderDialog();

    fireEvent.change(screen.getByLabelText('Sprint name'), {
      target: { value: updatedSprint.name },
    });
    fireEvent.submit(screen.getByLabelText('Sprint name').closest('form')!);

    await waitFor(() => {
      expect(updateSprint).toHaveBeenCalledWith(
        sprint.id,
        {
          name: updatedSprint.name,
          goal: sprint.goal,
          projectId: sprint.project!.id,
          startDate: sprint.startDate,
          endDate: sprint.endDate,
        },
        sprint.updatedAt
      );
    });
    expect(onUpdated).toHaveBeenCalledWith(updatedSprint);
  });

  it('keeps the dialog open and displays an update error', async () => {
    vi.mocked(updateSprint).mockRejectedValue(new Error('Update rejected'));
    const { onClose, onUpdated } = renderDialog();

    fireEvent.submit(screen.getByLabelText('Sprint name').closest('form')!);

    expect(await screen.findByText('Update rejected')).toBeInTheDocument();
    expect(screen.getByText('Edit Sprint')).toBeInTheDocument();
    expect(onUpdated).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
