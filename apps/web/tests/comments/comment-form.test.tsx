import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { CommentsFeed } from '@/app/comments/_components/comments-feed';
import type { CommentItem } from '@/app/comments/_services/comments.service';
import {
  createCommentAction,
  updateCommentAction,
} from '@/app/comments/_components/actions';
import { userFactory } from '../factories/user.factory';
import { projectFactory } from '../factories/project.factory';
import { workItemFactory } from '../factories/workItem.factory';
import { commentFactory } from '../factories/comment.factory';

const mockOrder = vi.fn();
const mockEq = vi.fn(() => ({ order: mockOrder }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));
const mockGetUser = vi.fn();

vi.mock('@/lib/supabase/client', () => {
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

function renderForm(
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

describe('Comment Form Dialog & Editor', () => {
  beforeEach(() => {
    mockOrder.mockImplementation(() => new Promise(() => {}));
    mockGetUser.mockImplementation(() => new Promise(() => {}));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('opens new comment dialog when New Comment button is clicked', () => {
    renderForm();

    const newCommentBtn = screen.getByRole('button', { name: /New Comment/i });
    fireEvent.click(newCommentBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Post New Comment')).toBeInTheDocument();
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
    vi.mocked(createCommentAction).mockResolvedValue({
      success: true,
      data: mockCreatedComment,
    });

    renderForm({ workItemId: 'wi-1' });

    const textarea = screen.getByPlaceholderText(
      /Share your thoughts, feedback, or update/i
    );
    fireEvent.change(textarea, {
      target: { value: 'New testing comment text.' },
    });

    const postBtn = screen.getByRole('button', { name: /Post Comment/i });
    await waitFor(() => expect(postBtn).not.toBeDisabled());
    fireEvent.click(postBtn);

    await waitFor(() => {
      expect(createCommentAction).toHaveBeenCalledWith({
        work_item_id: 'wi-1',
        content: 'New testing comment text.',
      });
    });
  });

  it('calls updateComment when a comment is edited and saved', async () => {
    const mockUpdatedComment: CommentItem = {
      ...mockComments[0]!,
      content: 'Security audit completed for the auth module (Updated).',
      edited: true,
    };
    vi.mocked(updateCommentAction).mockResolvedValue({
      success: true,
      data: mockUpdatedComment,
    });

    renderForm();

    // Open dropdown menu
    const menuBtn = screen.getAllByRole('button', { name: /Open menu/i })[0]!;
    fireEvent.click(menuBtn);

    // Click Edit button
    const editBtn = screen.getAllByText('Edit')[0]!;
    fireEvent.click(editBtn);

    // Wait for the edit textarea to be populated and rendered
    const textarea = await screen.findByDisplayValue(
      'Security audit completed for the auth module.'
    );

    // Modify the textarea content
    fireEvent.change(textarea, {
      target: {
        value: 'Security audit completed for the auth module (Updated).',
      },
    });
    await waitFor(() =>
      expect(textarea).toHaveValue(
        'Security audit completed for the auth module (Updated).'
      )
    );

    // Click Save
    const saveBtn = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateCommentAction).toHaveBeenCalledWith(
        'comment-1',
        'Security audit completed for the auth module (Updated).'
      );
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
    vi.mocked(updateCommentAction).mockResolvedValue({
      success: true,
      data: mockUpdatedReply,
    });

    renderForm();

    // Open dropdown menu for reply (the second Open menu button)
    const menuBtn = screen.getAllByRole('button', { name: /Open menu/i })[1]!;
    fireEvent.click(menuBtn);

    // Click Edit button (the second Edit button)
    const editBtn = screen.getAllByText('Edit')[1]!;
    fireEvent.click(editBtn);

    // Wait for the edit textarea to be populated and rendered
    const textarea = await screen.findByDisplayValue(
      'Yes, this is a reply to the security audit.'
    );

    // Modify the textarea content
    fireEvent.change(textarea, {
      target: {
        value: 'Yes, this is a reply to the security audit (Updated).',
      },
    });
    await waitFor(() =>
      expect(textarea).toHaveValue(
        'Yes, this is a reply to the security audit (Updated).'
      )
    );

    // Click Save
    const saveBtn = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateCommentAction).toHaveBeenCalledWith(
        'reply-1',
        'Yes, this is a reply to the security audit (Updated).'
      );
    });
  });

  it('triggers mentions dropdown and inserts mention when @ user is typed/selected', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    renderForm({ workItemId: 'wi-1' });

    const textarea = screen.getByPlaceholderText(
      /Share your thoughts, feedback, or update/i
    );

    // Type '@' to trigger mentions dropdown
    fireEvent.change(textarea, { target: { value: '@', selectionStart: 1 } });

    // Wait for the dropdown option to be visible
    const option = await screen.findByText('Alana Admin');
    expect(option).toBeInTheDocument();

    // Click on Alana Admin option
    fireEvent.click(option);

    // Verify it inserts mention text
    expect(textarea).toHaveValue('@Alana Admin ');
  });

  it('calls createCommentAction with parent_id when a threaded reply is posted', async () => {
    vi.mocked(createCommentAction).mockResolvedValue({
      success: true,
      data: commentFactory.build({ id: 'reply-2', parent_id: 'comment-1' }),
    });

    renderForm();

    // Find the Reply button for the first comment
    const replyBtns = screen.getAllByRole('button', { name: /Reply/i });
    fireEvent.click(replyBtns[0]!);

    // Find the reply input by placeholder
    const replyInput = screen.getByPlaceholderText('Write a reply...');
    fireEvent.change(replyInput, { target: { value: 'This is my threaded reply content' } });

    // Click Post button
    const postBtn = screen.getByRole('button', { name: 'Post' });
    fireEvent.click(postBtn);

    await waitFor(() => {
      expect(createCommentAction).toHaveBeenCalledWith({
        work_item_id: 'wi-1',
        content: 'This is my threaded reply content',
        parent_id: 'comment-1',
      });
    });
  });
});
