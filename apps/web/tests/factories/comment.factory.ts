import type {
  CommentItem,
  CommentUser,
  CommentWorkItem,
} from '@/app/comments/_services/comments.service';
import { formatDateToISOString } from '@/app/_shared/utility';

const defaultAuthor: CommentUser = {
  id: 'user-admin-1',
  name: 'Alice Admin',
  email: 'admin@alice.dev',
  role: 'admin',
};

const defaultWorkItem: CommentWorkItem = {
  id: 'wi-1',
  title: 'Implement Authentication Flow',
  key: 'ALICE-1',
  type: 'Story',
  project: {
    id: 'proj-1',
    name: 'Jira Teams Core',
    key: 'ALICE',
  },
};

export const commentFactory = {
  build(overrides: Partial<CommentItem> = {}): CommentItem {
    return {
      id: 'comment-1',
      work_item_id: 'wi-1',
      author_id: defaultAuthor.id,
      parent_id: null,
      content: 'Security audit completed for the auth module.',
      edited: false,
      status: 'active',
      created_at: formatDateToISOString(2026, 6, 20, 10, 0, 0),
      updated_at: formatDateToISOString(2026, 6, 20, 10, 0, 0),
      author: defaultAuthor,
      work_item: defaultWorkItem,
      ...overrides,
    };
  },

  buildList(count: number, overrides: Partial<CommentItem> = {}): CommentItem[] {
    return Array.from({ length: count }, (_, index) =>
      commentFactory.build({
        id: `comment-${index + 1}`,
        content: `Comment content ${index + 1}`,
        ...overrides,
      })
    );
  },
};
