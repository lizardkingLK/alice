import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkItemPathBreadcrumb } from '@/app/work-items/_components/work-item-path-breadcrumb';
import { workItemFactory } from '../factories/workItem.factory';
import { toShortId } from '@/app/_shared/utility';
import type { WorkItemAncestor } from '@/app/work-items/_services/workItem.service.server';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    title,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    title?: string;
  }) => (
    <a href={href} title={title} {...props}>
      {children}
    </a>
  ),
}));

describe('WorkItemPathBreadcrumb', () => {
  const project = {
    id: 'proj-1',
    key: 'PAL',
    name: 'Project Alpha',
  };

  it('renders project, sprint ellipsis, and current item without ancestors', () => {
    // Arrange
    const workItem = workItemFactory.build({
      id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      type: 'Epic',
      sprint_id: null,
      project,
      sprint: null,
    });

    // Act
    render(<WorkItemPathBreadcrumb workItem={workItem} />);

    // Assert
    expect(screen.getByRole('link', { name: 'PAL' })).toHaveAttribute(
      'href',
      '/projects/proj-1'
    );
    expect(screen.getByText('Epic')).toBeInTheDocument();
    expect(screen.getByText(toShortId(workItem.id))).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Epic/i })
    ).not.toBeInTheDocument();
  });

  it('renders one parent ancestor as a link', () => {
    // Arrange
    const parent: WorkItemAncestor = {
      id: '11111111-1111-1111-1111-111111111111',
      type: 'Story',
      title: 'Parent story',
      parent_id: null,
    };
    const workItem = workItemFactory.build({
      id: '22222222-2222-2222-2222-222222222222',
      type: 'Task',
      parent_id: parent.id,
      sprint_id: 'sprint-1',
      project,
      sprint: { id: 'sprint-1', name: 'Sprint 1' },
    });

    // Act
    render(<WorkItemPathBreadcrumb workItem={workItem} ancestors={[parent]} />);

    // Assert
    expect(screen.getByText('Sprint 1')).toBeInTheDocument();
    const parentLink = screen.getByRole('link', { name: /Story/i });
    expect(parentLink).toHaveAttribute('href', `/work-items/${parent.id}`);
    expect(parentLink).toHaveAttribute('title', 'Parent story');
    expect(screen.getByText(toShortId(parent.id))).toBeInTheDocument();
    expect(screen.getByText('Task')).toBeInTheDocument();
    expect(screen.getByText(toShortId(workItem.id))).toBeInTheDocument();
  });

  it('renders full ancestor chain root-first with links', () => {
    // Arrange
    const epic: WorkItemAncestor = {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      type: 'Epic',
      title: 'Root epic',
      parent_id: null,
    };
    const story: WorkItemAncestor = {
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      type: 'Story',
      title: 'Mid story',
      parent_id: epic.id,
    };
    const task: WorkItemAncestor = {
      id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      type: 'Task',
      title: 'Parent task',
      parent_id: story.id,
    };
    const issue = workItemFactory.build({
      id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      type: 'Issue',
      parent_id: task.id,
      project,
      sprint_id: null,
      sprint: null,
    });

    // Act
    render(
      <WorkItemPathBreadcrumb
        workItem={issue}
        ancestors={[epic, story, task]}
      />
    );

    // Assert
    expect(screen.getByRole('link', { name: /Epic/i })).toHaveAttribute(
      'href',
      `/work-items/${epic.id}`
    );
    expect(screen.getByRole('link', { name: /Story/i })).toHaveAttribute(
      'href',
      `/work-items/${story.id}`
    );
    expect(screen.getByRole('link', { name: /Task/i })).toHaveAttribute(
      'href',
      `/work-items/${task.id}`
    );
    expect(screen.getByText('Issue')).toBeInTheDocument();
    expect(screen.getByText(toShortId(issue.id))).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Issue/i })
    ).not.toBeInTheDocument();
  });
});
