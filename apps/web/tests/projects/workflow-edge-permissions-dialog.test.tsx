import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkflowEdgePermissionsDialog } from '@/app/projects/_components/project-details/workflow-edge-permissions-dialog';
import { DIALOG_CLOSE_ANIMATION_MS } from '@/lib/dialog-close';

describe('WorkflowEdgePermissionsDialog', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('requires at least one matcher before apply', () => {
    const onApply = vi.fn();
    render(
      <WorkflowEdgePermissionsDialog
        open
        onOpenChange={vi.fn()}
        fromName="To Do"
        toName="Done"
        savedAllowAnyOf={[]}
        teams={[]}
        members={[]}
        onApply={onApply}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /^apply$/i }));
    expect(
      screen.getByText(/select at least one role, team, or member/i)
    ).toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('applies selected role matchers', () => {
    const onApply = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <WorkflowEdgePermissionsDialog
        open
        onOpenChange={onOpenChange}
        fromName="To Do"
        toName="Done"
        savedAllowAnyOf={[]}
        teams={[]}
        members={[]}
        onApply={onApply}
      />
    );

    fireEvent.click(screen.getByLabelText(/^manager$/i));
    fireEvent.click(screen.getByRole('button', { name: /^apply$/i }));

    expect(onApply).toHaveBeenCalledWith([{ scope: 'role', role: 'manager' }]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('applies everyone by clearing matchers', async () => {
    vi.useFakeTimers();
    const onApply = vi.fn();
    render(
      <WorkflowEdgePermissionsDialog
        open
        onOpenChange={vi.fn()}
        fromName="To Do"
        toName="Done"
        savedAllowAnyOf={[{ scope: 'role', role: 'admin' }]}
        teams={[]}
        members={[]}
        onApply={onApply}
      />
    );

    fireEvent.click(screen.getByRole('combobox', { name: /access mode/i }));
    fireEvent.click(screen.getByRole('option', { name: /^everyone$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^apply$/i }));

    expect(onApply).toHaveBeenCalledWith([]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DIALOG_CLOSE_ANIMATION_MS);
    });
  });
});
