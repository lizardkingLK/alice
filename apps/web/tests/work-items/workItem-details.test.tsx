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
      screen.queryByRole('button', { name: /Add subtask/i })
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

    // Arrange — with children
    const child = workItemFactory.build({
      id: 'wi-child',
      title: 'Child task title',
      type: 'Task',
      parent_id: story.id,
      status: 'Done',
    });
    rerender(
      <WorkItemDetails
        workItemDetails={story}
        project={project}
        childWorkItems={[child]}
        projectMembers={members}
      />
    );

    // Assert
    expect(screen.getByText('Child task title')).toBeInTheDocument();
    expect(screen.getByText('100% Done')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Child task title/i })
    ).toHaveAttribute('href', '/work-items/wi-child');
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
});
