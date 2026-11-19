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
        startAtInput="2026-10-11T23:30"
        endAtInput="2026-10-12T01:00"
        workLogCommentInput="Fix tests"
        isLoggingWork={false}
        onStartAtChange={() => {}}
        onEndAtChange={() => {}}
        onWorkLogCommentChange={() => {}}
        onSubmit={(event) => event.preventDefault()}
      />
    );

    // Assert
    expect(screen.getByLabelText('Work log form')).toBeInTheDocument();
    expect(screen.getByLabelText(/Start date and time/i)).toHaveValue(
      '2026-10-11T23:30'
    );
    expect(screen.getByLabelText(/End date and time/i)).toHaveValue(
      '2026-10-12T01:00'
    );
    expect(screen.getByText('1h 30m')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Only the start date, calculated duration, and description are saved/i
      )
    ).toBeInTheDocument();
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
        startAtInput="2026-10-11T08:00"
        endAtInput="2026-10-11T10:00"
        workLogCommentInput=""
        isLoggingWork={false}
        onStartAtChange={() => {}}
        onEndAtChange={() => {}}
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
