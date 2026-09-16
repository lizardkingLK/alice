import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
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
  beforeEach(() => sessionStorage.clear());

  it('renders the draft and stores it before opening the project board tab', () => {
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

    expect(screen.getByText(/Board Draft Created:/)).toHaveTextContent(
      'Board Draft Created: Alpha Project'
    );
    const link = screen.getByRole('link', {
      name: 'Open in Board Designer',
    });
    expect(link).toHaveAttribute('href', '/projects/project-1?tab=board');

    fireEvent.click(link);
    expect(sessionStorage.getItem('board_draft_project-1')).toBe(
      JSON.stringify(config)
    );
  });
});
