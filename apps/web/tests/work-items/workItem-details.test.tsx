import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WorkItemDetails from '@/app/work-items/_components/workItem-details';
import {
  mockRefresh,
  configureNextNavigationMock,
  resetNextNavigationMock,
} from '../mocks/next-navigation';
import { projectFactory } from '../factories/project.factory';
import { workItemFactory } from '../factories/workItem.factory';
import { userFactory } from '../factories/user.factory';

vi.mock('next/navigation', () => import('../mocks/next-navigation'));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@repo/ui/components/ui/sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/app/work-items/_components/work-item-path-breadcrumb', () => ({
  WorkItemPathBreadcrumb: () => <div data-testid="path-breadcrumb" />,
}));

vi.mock('@/app/work-items/_components/workItem-title-editor', () => ({
  WorkItemTitleEditor: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

vi.mock('@/app/work-items/_components/workItem-description-view', () => ({
  DescriptionView: () => <div data-testid="description-view" />,
}));

vi.mock('@/app/work-items/_components/workItem-description-editor', () => ({
  default: () => <div data-testid="description-editor" />,
}));

vi.mock('@/app/work-items/_components/work-item-attachments-section', () => ({
  AttachmentsSection: () => <div data-testid="attachments-section" />,
}));

vi.mock('@/app/work-items/_components/work-item-activity-tabs', () => ({
  WorkItemActivityTabs: () => <div data-testid="activity-tabs" />,
}));

vi.mock('@/app/work-items/_components/workItem-details-sidebar', () => ({
  default: () => <aside data-testid="work-item-sidebar" />,
}));

vi.mock('@/app/work-items/_components/work-item-form-dialog', () => ({
  WorkItemFormDialog: ({
    open,
    title,
    parentId,
    allowedTypes,
    onSuccess,
    onClose,
  }: {
    open: boolean;
    title: string;
    parentId?: string | null;
    allowedTypes?: readonly string[];
    // eslint-disable-next-line no-unused-vars
    onSuccess?: (workItem: unknown) => void;
    onClose?: () => void;
  }) =>
    open ? (
      <div data-testid="subtask-dialog">
        <span>{title}</span>
        <span data-testid="dialog-parent-id">{parentId}</span>
        <span data-testid="dialog-allowed-types">
          {allowedTypes?.join(',') ?? ''}
        </span>
        <button
          type="button"
          onClick={() => onSuccess?.(workItemFactory.build())}
        >
          Succeed create
        </button>
        <button type="button" onClick={onClose}>
          Close dialog
        </button>
      </div>
    ) : null,
}));

vi.mock('@/app/work-items/_components/work-item-link-subtask-dialog', () => ({
  WorkItemLinkSubtaskDialog: ({
    open,
    parentWorkItemId,
    childType,
    onLinked,
    onOpenChange,
  }: {
    open: boolean;
    parentWorkItemId: string;
    childType: string;
    onLinked?: () => void;
    // eslint-disable-next-line no-unused-vars
    onOpenChange?: (open: boolean) => void;
  }) =>
    open ? (
      <div data-testid="link-subtask-dialog">
        <span>Link Subtask</span>
        <span data-testid="link-parent-id">{parentWorkItemId}</span>
        <span data-testid="link-child-type">{childType}</span>
        <button type="button" onClick={() => onLinked?.()}>
          Succeed link
        </button>
        <button type="button" onClick={() => onOpenChange?.(false)}>
          Close link dialog
        </button>
      </div>
    ) : null,
}));

describe('WorkItemDetails subtasks', () => {
  const project = projectFactory.build();
  const members = userFactory.buildList(1).map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    profile_picture: null,
  }));

  beforeEach(() => {
    vi.clearAllMocks();
    resetNextNavigationMock();
    configureNextNavigationMock({ pathname: '/work-items/wi-story' });
  });

  it('shows Create subtask for Story and opens dialog with Task + parent_id', () => {
    // Arrange
    const story = workItemFactory.build({
      id: 'wi-story',
      type: 'Story',
      title: 'Parent story',
      project_id: project.id,
    });

    render(
      <WorkItemDetails
        workItemDetails={story}
        project={project}
        projectMembers={members}
      />
    );

    // Act
    fireEvent.click(screen.getByRole('button', { name: /Create subtask/i }));

    // Assert
    expect(screen.getByTestId('subtask-dialog')).toBeInTheDocument();
    expect(screen.getByText('Create Subtask')).toBeInTheDocument();
    expect(screen.getByTestId('dialog-parent-id')).toHaveTextContent(
      'wi-story'
    );
    expect(screen.getByTestId('dialog-allowed-types')).toHaveTextContent(
      'Task'
    );
  });

  it('hides Create subtask for Issue (leaf type)', () => {
    // Arrange
    const issue = workItemFactory.build({
      id: 'wi-issue',
      type: 'Issue',
      title: 'Leaf issue',
      project_id: project.id,
    });

    render(
      <WorkItemDetails
        workItemDetails={issue}
        project={project}
        projectMembers={members}
      />
    );

    // Assert
    expect(
      screen.queryByRole('button', { name: /Create subtask/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Link existing subtask/i })
    ).not.toBeInTheDocument();
  });

  it('renders Subtasks section with children and empty state', () => {
    // Arrange — empty
    const story = workItemFactory.build({
      id: 'wi-story',
      type: 'Story',
      project_id: project.id,
    });
    const { rerender } = render(
      <WorkItemDetails
        workItemDetails={story}
        project={project}
        childWorkItems={[]}
        projectMembers={members}
      />
    );

    // Assert
    expect(
      screen.getByRole('heading', { name: 'Subtasks' })
    ).toBeInTheDocument();
    expect(screen.getByText(/No subtasks yet/i)).toBeInTheDocument();

    // Arrange — with children (mixed completion)
    const doneChild = workItemFactory.build({
      id: 'wi-child-done',
      title: 'Child task title',
      type: 'Task',
      parent_id: story.id,
      status: 'Done',
    });
    const inProgressChild = workItemFactory.build({
      id: 'wi-child-wip',
      title: 'In progress child',
      type: 'Task',
      parent_id: story.id,
      status: 'InProgress',
    });
    const todoChild = workItemFactory.build({
      id: 'wi-child-todo',
      title: 'Todo child',
      type: 'Task',
      parent_id: story.id,
      status: 'ToDo',
    });
    rerender(
      <WorkItemDetails
        workItemDetails={story}
        project={project}
        childWorkItems={[doneChild, inProgressChild, todoChild]}
        projectMembers={members}
      />
    );

    // Assert — (100 + 25 + 0) / 3 ≈ 42
    expect(screen.getByText('Child task title')).toBeInTheDocument();
    expect(screen.getByText('42% Done')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Child task title/i })
    ).toHaveAttribute('href', '/work-items/wi-child-done');
  });

  it('refreshes the page after a successful subtask create', async () => {
    // Arrange
    const story = workItemFactory.build({
      id: 'wi-story',
      type: 'Story',
      project_id: project.id,
    });

    render(
      <WorkItemDetails
        workItemDetails={story}
        project={project}
        projectMembers={members}
      />
    );

    // Act
    fireEvent.click(screen.getByRole('button', { name: /Create subtask/i }));
    fireEvent.click(screen.getByRole('button', { name: /Succeed create/i }));

    // Assert
    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });
  });

  it('opens Link Subtask from Subtasks + and keeps Create separate', async () => {
    // Arrange
    const story = workItemFactory.build({
      id: 'wi-story',
      type: 'Story',
      project_id: project.id,
    });
    const linkable = workItemFactory.build({
      id: 'wi-orphan-task',
      type: 'Task',
      title: 'Orphan task',
      parent_id: null,
      project_id: project.id,
    });

    render(
      <WorkItemDetails
        workItemDetails={story}
        project={project}
        projectMembers={members}
        linkableWorkItems={[linkable]}
      />
    );

    // Act — link via section plus
    fireEvent.click(
      screen.getByRole('button', { name: /Link existing subtask/i })
    );

    // Assert
    expect(screen.getByTestId('link-subtask-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('link-parent-id')).toHaveTextContent('wi-story');
    expect(screen.getByTestId('link-child-type')).toHaveTextContent('Task');
    expect(screen.queryByTestId('subtask-dialog')).not.toBeInTheDocument();

    // Act — create still works independently
    fireEvent.click(screen.getByRole('button', { name: /Close link dialog/i }));
    fireEvent.click(screen.getByRole('button', { name: /Create subtask/i }));

    // Assert
    expect(screen.getByTestId('subtask-dialog')).toBeInTheDocument();
    expect(screen.queryByTestId('link-subtask-dialog')).not.toBeInTheDocument();
  });

  it('refreshes after linking an existing subtask', async () => {
    // Arrange
    const story = workItemFactory.build({
      id: 'wi-story',
      type: 'Story',
      project_id: project.id,
    });

    render(
      <WorkItemDetails
        workItemDetails={story}
        project={project}
        projectMembers={members}
      />
    );

    // Act
    fireEvent.click(
      screen.getByRole('button', { name: /Link existing subtask/i })
    );
    fireEvent.click(screen.getByRole('button', { name: /Succeed link/i }));

    // Assert
    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });
  });
});
