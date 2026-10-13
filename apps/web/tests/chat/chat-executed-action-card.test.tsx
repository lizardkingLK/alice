import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChatExecutedActionCard } from '@/app/chat/_components/chat-executed-action-card';

const config = {
  version: '1' as const,
  columns: [
    { id: 'new', name: 'New', status: 'New' as const },
    { id: 'todo', name: 'To Do', status: 'ToDo' as const },
    { id: 'doing', name: 'Doing', status: 'InProgress' as const },
    { id: 'testing', name: 'Testing', status: 'Testing' as const },
    { id: 'done', name: 'Done', status: 'Done' as const },
  ],
};

describe('configure board chat action card', () => {
  it('renders a retired board draft and links to the Workflow designer', () => {
    render(
      <ChatExecutedActionCard
        action={{
          type: 'configure_board',
          entity: {
            projectId: 'project-1',
            projectName: 'Alpha Project',
            config,
          },
        }}
      />
    );

    expect(screen.getByText(/Board draft \(retired\):/)).toHaveTextContent(
      'Board draft (retired): Alpha Project'
    );
    const link = screen.getByRole('link', {
      name: 'Open Workflow designer',
    });
    expect(link).toHaveAttribute('href', '/projects/project-1?tab=workflow');
  });
});

describe('dismiss workflow chat action card', () => {
  it('renders dismiss confirmation with reason', () => {
    render(
      <ChatExecutedActionCard
        action={{
          type: 'dismiss_workflow_patch',
          entity: {
            projectId: 'project-1',
            projectName: 'Alpha Project',
            reason: 'Testing state already exists',
          },
        }}
      />
    );

    expect(
      screen.getByText(/Workflow proposal dismissed for/)
    ).toHaveTextContent(
      'Workflow proposal dismissed for Alpha Project: Testing state already exists'
    );
  });
});
