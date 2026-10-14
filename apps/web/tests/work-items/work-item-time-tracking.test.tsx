import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkItemTimeTracking } from '@/app/work-items/_components/work-item-work-logs/work-item-time-tracking';
import type { WorkItemWorkLog } from '@repo/types';

vi.mock('@repo/ui/components/ui/collapsible', () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CollapsibleTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

describe('WorkItemTimeTracking', () => {
  it('omits estimated and styles fractions like short-id mono text', () => {
    const workLogs: WorkItemWorkLog[] = [
      {
        id: 'log-1',
        work_item_id: 'wi-1',
        user_id: 'user-1',
        logged_hours: 0.5,
        logged_at: '2026-10-14',
        comment: null,
      },
    ];

    const { container } = render(
      <WorkItemTimeTracking
        storyPoints={2}
        workLogs={workLogs}
        remainingFillClassName="bg-amber-500"
      />
    );

    expect(screen.queryByText('Estimated')).not.toBeInTheDocument();
    expect(screen.getByText('Remaining')).toBeInTheDocument();
    expect(screen.getByText('Logged')).toBeInTheDocument();

    const remainingValue = screen.getByText('1h 30m / 2h');
    const loggedValue = screen.getByText('30m / 2h');
    expect(remainingValue).toHaveClass('font-mono', 'font-normal');
    expect(loggedValue).toHaveClass('font-mono', 'font-normal');

    expect(container.querySelectorAll('.bg-muted.h-2')).toHaveLength(2);
  });
});
