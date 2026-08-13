import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CommentsFeed } from '@/app/comments/_components/comments-feed';
import type {
  CommentItem,
  CommentWorkItemOption,
} from '@/app/comments/_services/comments.service';
import {
  archiveComment,
  restoreComment,
} from '@/app/comments/_services/comments.service';
import { userFactory } from '../factories/user.factory';
import { projectFactory } from '../factories/project.factory';
import { workItemFactory } from '../factories/workItem.factory';
import { commentFactory } from '../factories/comment.factory';
import { formatDateToISOString } from '@/app/_shared/utility';
import { plainTextToCommentDoc } from '@repo/types';

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
  };
});

vi.mock('@/app/comments/_components/comment-editor', async () => {
  const { MockCommentEditor } = await import('./mock-comment-editor');
  return { CommentEditor: MockCommentEditor };
});

vi.mock('@/app/comments/_services/comments.service', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('@/app/comments/_services/comments.service')
    >();
  return {
    ...actual,
    updateComment: vi.fn(),
    archiveComment: vi.fn(),
    restoreComment: vi.fn(),
  };
});

vi.mock(
  '@repo/ui/components/ui/dropdown-menu',
  () => import('../mocks/dropdown-menu')
);

vi.mock('@repo/ui/components/ui/select', () =>
  import('../mocks/select').then((module) =>
    module.createSelectMock('status-select')
  )
);

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
  name: 'Alice Core',
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
  type: 'Task',
});

const mockWorkItems: CommentWorkItemOption[] = [
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
    content: plainTextToCommentDoc(
      'Security audit completed for the auth module.'
    ),
    edited: false,
    status: 'active',
    created_at: formatDateToISOString(2026, 6, 20, 10, 0, 0),
    updated_at: formatDateToISOString(2026, 6, 20, 10, 0, 0),
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
    content: plainTextToCommentDoc(
      'Navigation CSS alignment fix is ready for review.'
    ),
    edited: false,
    status: 'active',
    created_at: formatDateToISOString(2026, 6, 21, 8, 0, 0),
    updated_at: formatDateToISOString(2026, 6, 21, 8, 0, 0),
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
    content: plainTextToCommentDoc(
      'Yes, this is a reply to the security audit.'
    ),
    edited: false,
    status: 'active',
    created_at: formatDateToISOString(2026, 6, 20, 11, 0, 0),
    updated_at: formatDateToISOString(2026, 6, 20, 11, 0, 0),
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
    workItems: CommentWorkItemOption[];
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
      content: plainTextToCommentDoc(
        'Hey @[Alice Admin](user-admin-1) please check this.'
      ),
    };

    renderFeed({ initialComments: [commentWithMention] });
    expect(screen.getByText('@Alice Admin')).toBeInTheDocument();
    expect(screen.getByText(/please check this/)).toBeInTheDocument();
  });

  it('renders work item links with styled badges', () => {
    const commentWithIssue: CommentItem = {
      ...mockComments[0]!,
      id: 'comment-issue-1',
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Please refer to ' },
              {
                type: 'workItemMention',
                attrs: {
                  id: 'wi-1',
                  label: 'AL-1',
                  title: 'Login flow',
                  mentionType: 'workItem',
                },
              },
              { type: 'text', text: ' for details.' },
            ],
          },
        ],
      },
    };

    renderFeed({ initialComments: [commentWithIssue] });
    const link = screen.getByRole('link', { name: /#AL-1 · Login flow/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/work-items/wi-1');
    expect(screen.getByText(/for details/)).toBeInTheDocument();
  });

  it('renders composer when workItemId is provided', () => {
    renderFeed({ workItemId: 'wi-1' });

    expect(screen.getByText('Discussion (3)')).toBeInTheDocument();
    expect(
      screen.queryByText('Discussions & Comments')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('New Comment')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Add a comment...')).toBeInTheDocument();
  });

  it('calls archiveComment when a comment is archived', async () => {
    vi.mocked(archiveComment).mockResolvedValue(undefined);

    renderFeed({ currentUserId: aliceAdmin.id });

    const menuBtn = screen.getAllByRole('button', {
      name: /More actions/i,
    })[0]!;
    fireEvent.click(menuBtn);

    const archiveBtn = screen.getAllByText('Archive')[0]!;
    fireEvent.click(archiveBtn);

    await waitFor(() => {
      expect(archiveComment).toHaveBeenCalledWith(
        'comment-1',
        formatDateToISOString(2026, 6, 20, 10, 0, 0)
      );
    });
  });

  it('calls archiveComment (permanent) when an archived reply is purged', async () => {
    vi.mocked(archiveComment).mockResolvedValue(undefined);

    const archivedReply: CommentItem = {
      ...mockComments[2]!,
      status: 'archived',
    };

    renderFeed({
      currentUserId: aliceAdmin.id,
      initialComments: [mockComments[0]!, archivedReply],
      workItemId: workItem1.id,
    });

    const purgeBtn = screen.getByRole('button', { name: /Purge/i });
    fireEvent.click(purgeBtn);

    const confirmBtn = screen.getByRole('button', { name: 'Purge Comment' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(archiveComment).toHaveBeenCalledWith(
        'reply-1',
        formatDateToISOString(2026, 6, 20, 11, 0, 0),
        true
      );
    });
  });

  it('calls restoreComment when an archived parent comment is restored', async () => {
    const archivedComment: CommentItem = {
      ...mockComments[0]!,
      id: 'comment-archived-1',
      status: 'archived',
    };
    vi.mocked(restoreComment).mockResolvedValue(undefined);

    renderFeed({
      currentUserId: aliceAdmin.id,
      initialComments: [archivedComment],
    });

    const select = screen.getByTestId('status-select');
    fireEvent.change(select, { target: { value: 'archived' } });

    const restoreBtn = screen.getByRole('button', { name: /Restore/i });
    fireEvent.click(restoreBtn);

    await waitFor(() => {
      expect(restoreComment).toHaveBeenCalledWith(
        'comment-archived-1',
        formatDateToISOString(2026, 6, 20, 10, 0, 0)
      );
    });
  });

  it('calls archiveComment (permanent) when an archived parent comment is deleted permanently', async () => {
    const archivedComment: CommentItem = {
      ...mockComments[0]!,
      id: 'comment-archived-1',
      status: 'archived',
    };
    vi.mocked(archiveComment).mockResolvedValue(undefined);

    renderFeed({
      currentUserId: aliceAdmin.id,
      initialComments: [archivedComment],
    });

    const select = screen.getByTestId('status-select');
    fireEvent.change(select, { target: { value: 'archived' } });

    const deleteBtn = screen.getByRole('button', { name: /Purge/i });
    fireEvent.click(deleteBtn);

    const confirmBtn = screen.getByRole('button', { name: 'Purge Comment' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(archiveComment).toHaveBeenCalledWith(
        'comment-archived-1',
        formatDateToISOString(2026, 6, 20, 10, 0, 0),
        true
      );
    });
  });
});
