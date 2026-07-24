import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { CommentsFeed } from '@/app/comments/_components/comments-feed';
import {
  createComment,
  updateComment,
  archiveComment,
  type CommentItem,
} from '@/app/comments/_services/comments.service';

vi.mock('@/app/comments/_services/comments.service', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('@/app/comments/_services/comments.service')
    >();
  return {
    ...actual,
    createComment: vi.fn(),
    updateComment: vi.fn(),
    archiveComment: vi.fn(),
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

const mockWorkItems = [
  {
    id: 'wi-1',
    title: 'Implement Authentication Flow',
    key: 'ALICE-1',
    type: 'Story',
    project_id: 'proj-1',
    project_name: 'Jira Teams Core',
  },
  {
    id: 'wi-2',
    title: 'Fix Navigation Sidebar Glitch',
    key: 'ALICE-2',
    type: 'Bug',
    project_id: 'proj-1',
    project_name: 'Jira Teams Core',
  },
];

const mockComments: CommentItem[] = [
  {
    id: 'comment-1',
    work_item_id: 'wi-1',
    author_id: 'user-admin-1',
    parent_id: null,
    content: 'Security audit completed for the auth module.',
    edited: false,
    status: 'active',
    created_at: '2026-07-20T10:00:00Z',
    updated_at: '2026-07-20T10:00:00Z',
    author: {
      id: 'user-admin-1',
      name: 'Alice Admin',
      email: 'admin@alice.dev',
      role: 'admin',
    },
    work_item: {
      id: 'wi-1',
      title: 'Implement Authentication Flow',
      key: 'ALICE-1',
      type: 'Story',
      project: {
        id: 'proj-1',
        name: 'Jira Teams Core',
        key: 'ALICE',
      },
    },
  },
  {
    id: 'comment-2',
    work_item_id: 'wi-2',
    author_id: 'user-dev-1',
    parent_id: null,
    content: 'Navigation CSS alignment fix is ready for review.',
    edited: false,
    status: 'active',
    created_at: '2026-07-21T08:00:00Z',
    updated_at: '2026-07-21T08:00:00Z',
    author: {
      id: 'user-dev-1',
      name: 'Bob Developer',
      email: 'bob@alice.dev',
      role: 'member',
    },
    work_item: {
      id: 'wi-2',
      title: 'Fix Navigation Sidebar Glitch',
      key: 'ALICE-2',
      type: 'Bug',
    },
  },
  {
    id: 'reply-1',
    work_item_id: 'wi-1',
    author_id: 'user-admin-1',
    parent_id: 'comment-1',
    content: 'Yes, this is a reply to the security audit.',
    edited: false,
    status: 'active',
    created_at: '2026-07-20T11:00:00Z',
    updated_at: '2026-07-20T11:00:00Z',
    author: {
      id: 'user-admin-1',
      name: 'Alice Admin',
      email: 'admin@alice.dev',
      role: 'admin',
    },
  },
];

describe('CommentsFeed Component', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders stats bar, search input, and comment items', () => {
    render(
      <CommentsFeed initialComments={mockComments} workItems={mockWorkItems} />
    );

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
    render(
      <CommentsFeed initialComments={mockComments} workItems={mockWorkItems} />
    );

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

  it('opens new comment dialog when New Comment button is clicked', () => {
    render(
      <CommentsFeed initialComments={mockComments} workItems={mockWorkItems} />
    );

    const newCommentBtn = screen.getByRole('button', { name: /New Comment/i });
    fireEvent.click(newCommentBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Post New Comment')).toBeInTheDocument();
  });

  it('shows no comments message when search returns no matches', () => {
    render(
      <CommentsFeed initialComments={mockComments} workItems={mockWorkItems} />
    );

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

    render(
      <CommentsFeed
        initialComments={[commentWithMention]}
        workItems={mockWorkItems}
      />
    );
    expect(screen.getByText('@Alice Admin')).toBeInTheDocument();
    expect(screen.getByText(/please check this/)).toBeInTheDocument();
  });

  it('renders work item links with styled badges', () => {
    const commentWithIssue: CommentItem = {
      ...mockComments[0]!,
      id: 'comment-issue-1',
      content: 'Please refer to #[AL-1](wi-1) for details.',
    };

    render(
      <CommentsFeed
        initialComments={[commentWithIssue]}
        workItems={mockWorkItems}
      />
    );
    const link = screen.getByRole('link', { name: '#AL-1' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/work-items');
    expect(screen.getByText(/for details/)).toBeInTheDocument();
  });

  it('renders inline comments list and add box when workItemId is provided', () => {
    render(
      <CommentsFeed
        initialComments={mockComments}
        workItems={mockWorkItems}
        workItemId="wi-1"
      />
    );

    expect(screen.getByText('Discussion (3)')).toBeInTheDocument();
    expect(
      screen.queryByText('Discussions & Comments')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('New Comment')).not.toBeInTheDocument();
    expect(screen.getByText('Add to discussion')).toBeInTheDocument();
  });

  it('calls createComment when a new comment is submitted', async () => {
    const mockCreatedComment: CommentItem = {
      id: 'comment-new',
      work_item_id: 'wi-1',
      author_id: 'user-admin-1',
      parent_id: null,
      content: 'New testing comment text.',
      edited: false,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    vi.mocked(createComment).mockResolvedValue(mockCreatedComment);

    render(
      <CommentsFeed
        initialComments={mockComments}
        workItems={mockWorkItems}
        workItemId="wi-1"
      />
    );

    const textarea = screen.getByPlaceholderText(/Share your thoughts, feedback, or update/i);
    fireEvent.change(textarea, { target: { value: 'New testing comment text.' } });

    const postBtn = screen.getByRole('button', { name: /Post Comment/i });
    await waitFor(() => expect(postBtn).not.toBeDisabled());
    fireEvent.click(postBtn);

    await waitFor(() => {
      expect(createComment).toHaveBeenCalledWith({
        work_item_id: 'wi-1',
        content: 'New testing comment text.',
        author_id: 'user-admin-1',
      });
    });
  });

  it('calls updateComment when a comment is edited and saved', async () => {
    const mockUpdatedComment: CommentItem = {
      ...mockComments[0]!,
      content: 'Security audit completed for the auth module (Updated).',
      edited: true,
    };
    vi.mocked(updateComment).mockResolvedValue(mockUpdatedComment);

    render(
      <CommentsFeed initialComments={mockComments} workItems={mockWorkItems} />
    );

    // Open dropdown menu
    const menuBtn = screen.getAllByRole('button', { name: /Open menu/i })[0]!;
    fireEvent.click(menuBtn);

    // Click Edit button
    const editBtn = screen.getAllByText('Edit')[0]!;
    fireEvent.click(editBtn);

    // Wait for the edit textarea to be populated and rendered
    const textarea = await screen.findByDisplayValue('Security audit completed for the auth module.');

    // Modify the textarea content
    fireEvent.change(textarea, { target: { value: 'Security audit completed for the auth module (Updated).' } });
    await waitFor(() => expect(textarea).toHaveValue('Security audit completed for the auth module (Updated).'));

    // Click Save
    const saveBtn = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateComment).toHaveBeenCalledWith('comment-1', 'Security audit completed for the auth module (Updated).');
    });
  });

  it('calls archiveComment when a comment is archived', async () => {
    vi.mocked(archiveComment).mockResolvedValue(undefined);

    render(
      <CommentsFeed initialComments={mockComments} workItems={mockWorkItems} />
    );

    // Open dropdown menu
    const menuBtn = screen.getAllByRole('button', { name: /Open menu/i })[0]!;
    fireEvent.click(menuBtn);

    // Click Archive button
    const archiveBtn = screen.getAllByText('Archive')[0]!;
    fireEvent.click(archiveBtn);

    await waitFor(() => {
      expect(archiveComment).toHaveBeenCalledWith('comment-1');
    });
  });

  it('calls updateComment when a thread reply is edited and saved', async () => {
    const mockUpdatedReply: CommentItem = {
      id: 'reply-1',
      work_item_id: 'wi-1',
      author_id: 'user-admin-1',
      parent_id: 'comment-1',
      content: 'Yes, this is a reply to the security audit (Updated).',
      edited: true,
      status: 'active',
      created_at: '2026-07-20T11:00:00Z',
      updated_at: '2026-07-20T11:00:00Z',
      author: {
        id: 'user-admin-1',
        name: 'Alice Admin',
        email: 'admin@alice.dev',
        role: 'admin',
      },
    };
    vi.mocked(updateComment).mockResolvedValue(mockUpdatedReply);

    render(
      <CommentsFeed initialComments={mockComments} workItems={mockWorkItems} />
    );

    // Open dropdown menu for reply (the second Open menu button)
    const menuBtn = screen.getAllByRole('button', { name: /Open menu/i })[1]!;
    fireEvent.click(menuBtn);

    // Click Edit button (the second Edit button)
    const editBtn = screen.getAllByText('Edit')[1]!;
    fireEvent.click(editBtn);

    // Wait for the edit textarea to be populated and rendered
    const textarea = await screen.findByDisplayValue('Yes, this is a reply to the security audit.');

    // Modify the textarea content
    fireEvent.change(textarea, { target: { value: 'Yes, this is a reply to the security audit (Updated).' } });
    await waitFor(() => expect(textarea).toHaveValue('Yes, this is a reply to the security audit (Updated).'));

    // Click Save
    const saveBtn = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateComment).toHaveBeenCalledWith('reply-1', 'Yes, this is a reply to the security audit (Updated).');
    });
  });

  it('calls archiveComment when a thread reply is archived', async () => {
    vi.mocked(archiveComment).mockResolvedValue(undefined);

    render(
      <CommentsFeed initialComments={mockComments} workItems={mockWorkItems} />
    );

    // Open dropdown menu for reply (the second Open menu button)
    const menuBtn = screen.getAllByRole('button', { name: /Open menu/i })[1]!;
    fireEvent.click(menuBtn);

    // Click Archive button (the second Archive button)
    const archiveBtn = screen.getAllByText('Archive')[1]!;
    fireEvent.click(archiveBtn);

    await waitFor(() => {
      expect(archiveComment).toHaveBeenCalledWith('reply-1');
    });
  });
});
