import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { CommentsFeed } from '@/app/comments/_components/comments-feed';
import type { CommentItem } from '@/app/comments/_services/comments.service';
import {
  archiveCommentAction,
  restoreCommentAction,
} from '@/app/comments/_components/actions';
import { userFactory } from '../factories/user.factory';
import { projectFactory } from '../factories/project.factory';
import { workItemFactory } from '../factories/workItem.factory';
import { commentFactory } from '../factories/comment.factory';

vi.mock('@/lib/supabase/client', () => {
  const mockOrder = vi.fn(() => new Promise(() => {}));
  const mockEq = vi.fn(() => ({ order: mockOrder }));
  const mockSelect = vi.fn(() => ({ eq: mockEq }));
  const mockFrom = vi.fn(() => ({ select: mockSelect }));
  const mockGetUser = vi.fn(() => new Promise(() => {}));

  return {
    createClient: vi.fn(() => ({
      from: mockFrom,
      auth: {
        getUser: mockGetUser,
      },
    })),
  };
});

vi.mock('@/app/comments/_components/actions', () => {
  return {
    createCommentAction: vi.fn(),
    updateCommentAction: vi.fn(),
    archiveCommentAction: vi.fn(),
    restoreCommentAction: vi.fn(),
  };
});

// Mock Dropdown Menu to avoid testing Radix internals in the jsdom environment
vi.mock('@repo/ui/components/ui/dropdown-menu', () => {
  return {
    DropdownMenu: ({ children }: { children: ReactNode }) => (
      <div data-testid="dropdown-menu">{children}</div>
    ),
    DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
      <div data-testid="dropdown-menu-trigger">{children}</div>
    ),
    DropdownMenuContent: ({ children }: { children: ReactNode }) => (
      <div data-testid="dropdown-menu-content">{children}</div>
    ),
    DropdownMenuItem: ({
      children,
      onClick,
    }: {
      children: ReactNode;
      onClick?: () => void;
    }) => (
      <button type="button" onClick={onClick}>
        {children}
      </button>
    ),
  };
});

vi.mock('@repo/ui/components/ui/select', () => {
  return {
    Select: ({
      children,
      value,
      onValueChange,
    }: {
      children: ReactNode;
      value: string;
      // eslint-disable-next-line no-unused-vars
      onValueChange: (val: string) => void;
    }) => (
      <select
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        data-testid="status-select"
      >
        {children}
      </select>
    ),
    SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
    SelectValue: ({ placeholder }: { placeholder: string }) => (
      <>{placeholder}</>
    ),
    SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
    SelectItem: ({
      children,
      value,
    }: {
      children: ReactNode;
      value: string;
    }) => <option value={value}>{children}</option>,
  };
});

const aliceAdmin = userFactory.build({
  id: 'user-admin-1',
  name: 'Alice Admin',
  email: 'admin@alice.dev',
  role: 'admin',
});

const bobDev = userFactory.build({
  id: 'user-dev-1',
  name: 'Bob Developer',
  email: 'bob@alice.dev',
  role: 'member',
});

const proj1 = projectFactory.build({
  id: 'proj-1',
  name: 'Jira Teams Core',
  key: 'ALICE',
});

const workItem1 = workItemFactory.build({
  id: 'wi-1',
  title: 'Implement Authentication Flow',
  project_id: proj1.id,
  type: 'Story',
});

const workItem2 = workItemFactory.build({
  id: 'wi-2',
  title: 'Fix Navigation Sidebar Glitch',
  project_id: proj1.id,
  type: 'Bug' as never,
});

const mockWorkItems = [
  {
    id: workItem1.id,
    title: workItem1.title,
    key: 'ALICE-1',
    type: workItem1.type,
    project_id: workItem1.project_id,
    project_name: proj1.name,
  },
  {
    id: workItem2.id,
    title: workItem2.title,
    key: 'ALICE-2',
    type: workItem2.type,
    project_id: workItem2.project_id,
    project_name: proj1.name,
  },
];

const mockComments: CommentItem[] = [
  commentFactory.build({
    id: 'comment-1',
    work_item_id: workItem1.id,
    author_id: aliceAdmin.id,
    parent_id: null,
    content: 'Security audit completed for the auth module.',
    edited: false,
    status: 'active',
    created_at: '2026-07-20T10:00:00Z',
    updated_at: '2026-07-20T10:00:00Z',
    author: {
      id: aliceAdmin.id,
      name: aliceAdmin.name,
      email: aliceAdmin.email,
      role: aliceAdmin.role,
    },
    work_item: {
      id: workItem1.id,
      title: workItem1.title,
      key: 'ALICE-1',
      type: workItem1.type,
      project: {
        id: proj1.id,
        name: proj1.name,
        key: proj1.key,
      },
    },
  }),
  commentFactory.build({
    id: 'comment-2',
    work_item_id: workItem2.id,
    author_id: bobDev.id,
    parent_id: null,
    content: 'Navigation CSS alignment fix is ready for review.',
    edited: false,
    status: 'active',
    created_at: '2026-07-21T08:00:00Z',
    updated_at: '2026-07-21T08:00:00Z',
    author: {
      id: bobDev.id,
      name: bobDev.name,
      email: bobDev.email,
      role: bobDev.role,
    },
    work_item: {
      id: workItem2.id,
      title: workItem2.title,
      key: 'ALICE-2',
      type: workItem2.type,
    },
  }),
  commentFactory.build({
    id: 'reply-1',
    work_item_id: workItem1.id,
    author_id: aliceAdmin.id,
    parent_id: 'comment-1',
    content: 'Yes, this is a reply to the security audit.',
    edited: false,
    status: 'active',
    created_at: '2026-07-20T11:00:00Z',
    updated_at: '2026-07-20T11:00:00Z',
    author: {
      id: aliceAdmin.id,
      name: aliceAdmin.name,
      email: aliceAdmin.email,
      role: aliceAdmin.role,
    },
    work_item: null,
  }),
];

function renderFeed(
  overrides: Partial<{
    initialComments: CommentItem[];
    workItems: Array<{
      id: string;
      title: string;
      key: string;
      type: string;
      project_id: string;
      project_name?: string;
    }>;
    currentUserId: string;
    workItemId: string;
  }> = {}
) {
  return render(
    <CommentsFeed
      initialComments={overrides.initialComments ?? mockComments}
      workItems={overrides.workItems ?? mockWorkItems}
      currentUserId={overrides.currentUserId}
      workItemId={overrides.workItemId}
    />
  );
}

describe('CommentsFeed Component', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders stats bar, search input, and comment items', () => {
    renderFeed();

    expect(screen.getByText('Discussions & Comments')).toBeInTheDocument();
    expect(
      screen.getByText('Security audit completed for the auth module.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Navigation CSS alignment fix is ready for review.')
    ).toBeInTheDocument();
    expect(screen.getAllByText('Alice Admin')[0]).toBeInTheDocument();
    expect(screen.getByText('Bob Developer')).toBeInTheDocument();
  });

  it('filters comments based on search query', () => {
    renderFeed();

    const searchInput = screen.getByPlaceholderText(
      /Search comments by text, author, or issue key/i
    );
    fireEvent.change(searchInput, { target: { value: 'Security audit' } });

    expect(
      screen.getByText('Security audit completed for the auth module.')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Navigation CSS alignment fix is ready for review.')
    ).not.toBeInTheDocument();
  });

  it('shows no comments message when search returns no matches', () => {
    renderFeed();

    const searchInput = screen.getByPlaceholderText(
      /Search comments by text, author, or issue key/i
    );
    fireEvent.change(searchInput, {
      target: { value: 'Nonexistent text search query' },
    });

    expect(screen.getByText('No comments found')).toBeInTheDocument();
  });

  it('renders mentions with styled badges', () => {
    const commentWithMention: CommentItem = {
      ...mockComments[0]!,
      id: 'comment-mention-1',
      content: 'Hey @[Alice Admin](user-admin-1) please check this.',
    };

    renderFeed({ initialComments: [commentWithMention] });
    expect(screen.getByText('@Alice Admin')).toBeInTheDocument();
    expect(screen.getByText(/please check this/)).toBeInTheDocument();
  });

  it('renders work item links with styled badges', () => {
    const commentWithIssue: CommentItem = {
      ...mockComments[0]!,
      id: 'comment-issue-1',
      content: 'Please refer to #[AL-1](wi-1) for details.',
    };

    renderFeed({ initialComments: [commentWithIssue] });
    const link = screen.getByRole('link', { name: '#AL-1' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/work-items');
    expect(screen.getByText(/for details/)).toBeInTheDocument();
  });

  it('renders inline comments list and add box when workItemId is provided', () => {
    renderFeed({ workItemId: 'wi-1' });

    expect(screen.getByText('Discussion (3)')).toBeInTheDocument();
    expect(
      screen.queryByText('Discussions & Comments')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('New Comment')).not.toBeInTheDocument();
    expect(screen.getByText('Add to discussion')).toBeInTheDocument();
  });

  it('calls archiveComment when a comment is archived', async () => {
    vi.mocked(archiveCommentAction).mockResolvedValue({ success: true });

    renderFeed();

    // Open dropdown menu
    const menuBtn = screen.getAllByRole('button', { name: /Open menu/i })[0]!;
    fireEvent.click(menuBtn);

    // Click Archive button
    const archiveBtn = screen.getAllByText('Archive')[0]!;
    fireEvent.click(archiveBtn);

    await waitFor(() => {
      expect(archiveCommentAction).toHaveBeenCalledWith('comment-1');
    });
  });

  it('calls archiveCommentAction (permanent) when a thread reply is deleted', async () => {
    vi.mocked(archiveCommentAction).mockResolvedValue({ success: true });

    renderFeed();

    // Open dropdown menu for reply (the second Open menu button)
    const menuBtn = screen.getAllByRole('button', { name: /Open menu/i })[1]!;
    fireEvent.click(menuBtn);

    // Click Delete button to open modal
    const deleteBtn = screen.getByText('Delete');
    fireEvent.click(deleteBtn);

    // Click confirm delete button
    const confirmBtn = screen.getByRole('button', { name: 'Purge Comment' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(archiveCommentAction).toHaveBeenCalledWith('reply-1', true);
    });
  });

  it('calls restoreCommentAction when an archived parent comment is restored', async () => {
    const archivedComment: CommentItem = {
      ...mockComments[0]!,
      id: 'comment-archived-1',
      status: 'archived',
    };
    vi.mocked(restoreCommentAction).mockResolvedValue({ success: true });

    renderFeed({ initialComments: [archivedComment] });

    // Switch status filter to "archived"
    const select = screen.getAllByTestId('status-select')[1]!;
    fireEvent.change(select, { target: { value: 'archived' } });

    // Open dropdown menu
    const menuBtn = screen.getByRole('button', { name: /Open menu/i });
    fireEvent.click(menuBtn);

    // Click Restore button
    const restoreBtn = screen.getByText('Restore');
    fireEvent.click(restoreBtn);

    await waitFor(() => {
      expect(restoreCommentAction).toHaveBeenCalledWith('comment-archived-1');
    });
  });

  it('calls archiveCommentAction (permanent) when an archived parent comment is deleted permanently', async () => {
    const archivedComment: CommentItem = {
      ...mockComments[0]!,
      id: 'comment-archived-1',
      status: 'archived',
    };
    vi.mocked(archiveCommentAction).mockResolvedValue({ success: true });

    renderFeed({ initialComments: [archivedComment] });

    // Switch status filter to "archived"
    const select = screen.getAllByTestId('status-select')[1]!;
    fireEvent.change(select, { target: { value: 'archived' } });

    // Open dropdown menu
    const menuBtn = screen.getByRole('button', { name: /Open menu/i });
    fireEvent.click(menuBtn);

    // Click Purge button to open confirm modal
    const deleteBtn = screen.getByText('Purge');
    fireEvent.click(deleteBtn);

    // Click Purge Comment in the confirm modal
    const confirmBtn = screen.getByRole('button', { name: 'Purge Comment' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(archiveCommentAction).toHaveBeenCalledWith(
        'comment-archived-1',
        true
      );
    });
  });
});
