import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CommentsFeed } from '@/app/comments/_components/comments-feed';
import type {
  CommentItem,
  CommentWorkItemOption,
} from '@/app/comments/_services/comments.mutations.client';
import { createCommentAction } from '@/app/comments/_components/actions';
import { updateComment } from '@/app/comments/_services/comments.mutations.client';
import { userFactory } from '../factories/user.factory';
import { projectFactory } from '../factories/project.factory';
import { workItemFactory } from '../factories/workItem.factory';
import { commentFactory } from '../factories/comment.factory';
import { formatDateToISOString } from '@/app/_shared/utility';
import { plainTextToCommentDoc } from '@repo/types';

const { mockOrder, mockGetUser } = vi.hoisted(() => ({
  mockOrder: vi.fn().mockImplementation(() => Promise.resolve({ data: [], error: null })),
  mockGetUser: vi.fn().mockImplementation(() => Promise.resolve({ data: { user: null }, error: null })),
}));

vi.mock('@/lib/supabase/client', () => {
  const mockQueryBuilder = {
    eq: vi.fn().mockImplementation(() => mockQueryBuilder),
    in: vi.fn().mockImplementation(() => mockQueryBuilder),
    order: mockOrder,
    maybeSingle: vi.fn().mockImplementation(() => Promise.resolve({ data: null, error: null })),
    // eslint-disable-next-line no-unused-vars
    then: (resolve: (_data: { data: unknown[]; error: null }) => void) =>
      resolve({ data: [], error: null }),
  };

  const mockSelect = vi.fn().mockImplementation(() => mockQueryBuilder);
  const mockFrom = vi.fn().mockImplementation(() => ({ select: mockSelect }));

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

vi.mock(
  '@/app/comments/_services/comments.mutations.client',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@/app/comments/_services/comments.mutations.client')
      >();
    return {
      ...actual,
      updateComment: vi.fn(),
      archiveComment: vi.fn(),
      restoreComment: vi.fn(),
    };
  }
);

vi.mock('@/app/comments/_components/comment-editor', async () => {
  const { MockCommentEditor } = await import('./mock-comment-editor');
  return { CommentEditor: MockCommentEditor };
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

function renderForm(
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
      currentUserId={overrides.currentUserId ?? aliceAdmin.id}
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
      content: plainTextToCommentDoc('New testing comment text.'),
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

    const textarea = screen.getByPlaceholderText(/Add a comment/i);
    fireEvent.change(textarea, {
      target: { value: 'New testing comment text.' },
    });

    const postBtn = screen.getByRole('button', { name: /^Save$/i });
    fireEvent.click(postBtn);

    await waitFor(() => {
      expect(createCommentAction).toHaveBeenCalledWith({
        work_item_id: 'wi-1',
        content: plainTextToCommentDoc('New testing comment text.'),
        parent_id: null,
      });
    });
  });

  it('calls updateComment when a comment is edited and saved', async () => {
    const updatedText =
      'Security audit completed for the auth module (Updated).';
    const mockUpdatedComment: CommentItem = {
      ...mockComments[0]!,
      content: plainTextToCommentDoc(updatedText),
      edited: true,
    };
    vi.mocked(updateComment).mockResolvedValue(mockUpdatedComment);

    renderForm();

    const editBtn = screen.getAllByRole('button', { name: /^Edit$/i })[0]!;
    fireEvent.click(editBtn);

    const textarea = await screen.findByDisplayValue(
      'Security audit completed for the auth module.'
    );

    fireEvent.change(textarea, {
      target: { value: updatedText },
    });

    const saveBtn = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateComment).toHaveBeenCalledWith(
        'comment-1',
        plainTextToCommentDoc(updatedText),
        formatDateToISOString(2026, 6, 20, 10, 0, 0)
      );
    });
  });
});
