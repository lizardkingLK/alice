import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { WorkItemWorkLogDialog } from '@/app/work-items/_components/work-item-work-logs/work-item-work-log-dialog';

describe('WorkItemWorkLogDialog', () => {
  it('renders the log form when open', () => {
    // Arrange + Act
    render(
      <WorkItemWorkLogDialog
        open
        onOpenChange={() => {}}
        loggedHoursInput="1.5"
        loggedAtInput="2026-10-11"
        workLogCommentInput="Fix tests"
        isLoggingWork={false}
        onLoggedHoursChange={() => {}}
        onLoggedAtChange={() => {}}
        onWorkLogCommentChange={() => {}}
        onSubmit={(event) => event.preventDefault()}
      />
    );

    // Assert
    expect(screen.getByLabelText('Work log form')).toBeInTheDocument();
    expect(screen.getByLabelText(/Log time/i)).toHaveValue(1.5);
    expect(screen.getByLabelText(/Date started/i)).toHaveValue('2026-10-11');
    expect(screen.getByLabelText(/Work description/i)).toHaveValue('Fix tests');
  });

  it('calls onSubmit when Save is clicked', () => {
    // Arrange
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => {
      event.preventDefault();
    });
    render(
      <WorkItemWorkLogDialog
        open
        onOpenChange={() => {}}
        loggedHoursInput="2"
        loggedAtInput="2026-10-11"
        workLogCommentInput=""
        isLoggingWork={false}
        onLoggedHoursChange={() => {}}
        onLoggedAtChange={() => {}}
        onWorkLogCommentChange={() => {}}
        onSubmit={onSubmit}
      />
    );

    // Act
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    // Assert
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
