import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { WorkItemActivity } from '@repo/types';
import { WorkItemActivityFeed } from '@/app/work-items/_components/work-item-details/work-item-activity-feed';
import { WorkItemActivityTabs } from '@/app/work-items/_components/work-item-details/work-item-activity-tabs';

vi.mock('@/app/comments/_components/comments-feed', () => ({
  CommentsFeed: () => <div data-testid="comments-feed" />,
}));

vi.mock('@/app/comments/_components/comments-sort-menu', () => ({
  CommentsSortMenu: () => <div data-testid="comments-sort" />,
}));

vi.mock(
  '@/app/work-items/_components/work-item-work-logs/work-item-work-log-panel',
  () => ({
    WorkItemWorkLogPanel: () => <div data-testid="work-log-panel" />,
  })
);

const actor = {
  id: 'user-1',
  name: 'Alex',
  email: 'alex@example.com',
  profile_picture: null,
};

function buildActivity(
  overrides: Partial<WorkItemActivity> = {}
): WorkItemActivity {
  return {
    id: 'act-1',
    work_item_id: 'wi-1',
    actor_id: actor.id,
    action: 'field_changed',
    field: 'status',
    old_value: 'New',
    new_value: 'Done',
    meta: null,
    created_at: '2026-10-08T10:00:00.000Z',
    actor,
    ...overrides,
  };
}

describe('WorkItemActivityFeed', () => {
  it('shows empty state when there is no activity', () => {
    // Arrange + Act
    render(<WorkItemActivityFeed activities={[]} />);

    // Assert
    expect(screen.getByText('No activity yet')).toBeInTheDocument();
  });

  it('renders humanized field change lines', () => {
    // Arrange + Act
    render(<WorkItemActivityFeed activities={[buildActivity()]} />);

    // Assert
    expect(
      screen.getByText('Alex changed status from New to Done')
    ).toBeInTheDocument();
  });

  it('renders workflow transition lines from meta', () => {
    // Arrange + Act
    render(
      <WorkItemActivityFeed
        activities={[
          buildActivity({
            action: 'workflow_transition',
            field: 'state',
            old_value: 'st-new',
            new_value: 'st-done',
            meta: {
              fromStateId: 'st-new',
              toStateId: 'st-done',
              workflowId: 'wf-default',
              edgeId: 'e-1',
            },
          }),
        ]}
      />
    );

    // Assert
    expect(
      screen.getByText('Alex moved from st-new to st-done')
    ).toBeInTheDocument();
  });
});

describe('WorkItemActivityTabs maximize', () => {
  it('toggles maximize chrome for the section', () => {
    // Arrange
    render(
      <WorkItemActivityTabs
        activeTab="activity"
        onActiveTabChange={() => {}}
        initialComments={[]}
        initialActivities={[buildActivity()]}
        workItem={
          {
            id: 'wi-1',
            updated_at: '2026-10-08T10:00:00.000Z',
          } as never
        }
        discussionWorkItems={[]}
        workLogs={[]}
        loggedHoursInput=""
        loggedAtInput=""
        workLogCommentInput=""
        isLoggingWork={false}
        onLoggedHoursChange={() => {}}
        onLoggedAtChange={() => {}}
        onWorkLogCommentChange={() => {}}
        onWorkLogSubmit={() => {}}
      />
    );

    // Act
    fireEvent.click(screen.getByLabelText('Maximize section'));

    // Assert
    expect(screen.getByLabelText('Minimize section')).toBeInTheDocument();
    expect(
      screen.getByText('Alex changed status from New to Done')
    ).toBeInTheDocument();
  });
});
