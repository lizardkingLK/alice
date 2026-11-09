import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRoleEnum, type Json } from '@repo/types';
import { CommentsService } from '../../src/routes/api/comments/comments.service';
import type {
  CommentAccessContext,
  CommentRow,
  CommentsRepository,
} from '../../src/routes/api/comments/comments.repository';
import {
  CommentAccessError,
  CommentReplyScopeError,
} from '../../src/routes/api/comments/comments.errors';

const { getActorUserMock } = vi.hoisted(() => ({
  getActorUserMock: vi.fn(),
}));

vi.mock('../../src/lib/auth-helpers', () => ({
  getActorUser: getActorUserMock,
}));

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const AUTHOR_ID = '22222222-2222-4222-8222-222222222222';
const COMMENT_ID = '33333333-3333-4333-8333-333333333333';
const WORK_ITEM_ID = '44444444-4444-4444-8444-444444444444';
const OTHER_WORK_ITEM_ID = '55555555-5555-4555-8555-555555555555';
const PROJECT_ID = '66666666-6666-4666-8666-666666666666';
const UPDATED_AT = '2026-11-09T00:00:00.000Z';
const CONTENT: Json = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }],
};

function commentRow(overrides: Partial<CommentRow> = {}): CommentRow {
  return {
    id: COMMENT_ID,
    work_item_id: WORK_ITEM_ID,
    author_id: AUTHOR_ID,
    parent_id: null,
    content: CONTENT,
    reactions: [],
    edited: false,
    status: 'active',
    created_at: UPDATED_AT,
    updated_at: UPDATED_AT,
    created_by: AUTHOR_ID,
    updated_by: AUTHOR_ID,
    ...overrides,
  };
}

function accessContext(
  overrides: Partial<CommentAccessContext> = {}
): CommentAccessContext {
  return {
    commentId: COMMENT_ID,
    workItemId: WORK_ITEM_ID,
    authorId: AUTHOR_ID,
    parentId: null,
    projectId: PROJECT_ID,
    status: 'active',
    ...overrides,
  };
}

function setup() {
  const repository = {
    requireWorkItemProjectMember: vi.fn().mockResolvedValue({
      projectId: PROJECT_ID,
    }),
    requireProjectMember: vi.fn().mockResolvedValue(accessContext()),
    create: vi.fn().mockResolvedValue(commentRow()),
    update: vi.fn().mockResolvedValue(commentRow({ edited: true })),
    archive: vi.fn().mockResolvedValue(undefined),
    restore: vi.fn().mockResolvedValue(undefined),
    hardDelete: vi.fn().mockResolvedValue(undefined),
  };
  const notifications = {
    createMentionNotification: vi.fn().mockResolvedValue(undefined),
  };
  const service = new CommentsService(
    repository as unknown as CommentsRepository,
    notifications
  );
  return { repository, service };
}

type MutationCase = {
  name: string;
  repositoryMethod: 'update' | 'archive' | 'restore' | 'hardDelete';
  run: (service: CommentsService) => Promise<unknown>;
};

const MUTATIONS: MutationCase[] = [
  {
    name: 'update',
    repositoryMethod: 'update',
    run: (service) =>
      service.updateComment(COMMENT_ID, CONTENT, UPDATED_AT, ACTOR_ID),
  },
  {
    name: 'archive',
    repositoryMethod: 'archive',
    run: (service) => service.archiveComment(COMMENT_ID, UPDATED_AT, ACTOR_ID),
  },
  {
    name: 'restore',
    repositoryMethod: 'restore',
    run: (service) => service.restoreComment(COMMENT_ID, UPDATED_AT, ACTOR_ID),
  },
  {
    name: 'hard delete',
    repositoryMethod: 'hardDelete',
    run: (service) => service.hardDeleteComment(COMMENT_ID, ACTOR_ID),
  },
];

describe('CommentsService authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a comment only after work-item project access is verified', async () => {
    const { repository, service } = setup();

    await service.createComment(ACTOR_ID, {
      work_item_id: WORK_ITEM_ID,
      content: CONTENT,
    });

    expect(repository.requireWorkItemProjectMember).toHaveBeenCalledWith(
      WORK_ITEM_ID,
      ACTOR_ID
    );
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ author_id: ACTOR_ID })
    );
  });

  it('rejects comment creation outside accessible projects', async () => {
    const { repository, service } = setup();
    repository.requireWorkItemProjectMember.mockRejectedValue(
      new CommentAccessError()
    );

    await expect(
      service.createComment(ACTOR_ID, {
        work_item_id: WORK_ITEM_ID,
        content: CONTENT,
      })
    ).rejects.toBeInstanceOf(CommentAccessError);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('accepts a reply parent from the same work item', async () => {
    const { repository, service } = setup();
    repository.requireProjectMember.mockResolvedValue(
      accessContext({ commentId: COMMENT_ID, workItemId: WORK_ITEM_ID })
    );

    await service.createComment(ACTOR_ID, {
      work_item_id: WORK_ITEM_ID,
      parent_id: COMMENT_ID,
      content: CONTENT,
    });

    expect(repository.requireProjectMember).toHaveBeenCalledWith(
      COMMENT_ID,
      ACTOR_ID
    );
    expect(repository.create).toHaveBeenCalledOnce();
  });

  it('rejects a reply parent from another work item', async () => {
    const { repository, service } = setup();
    repository.requireProjectMember.mockResolvedValue(
      accessContext({ workItemId: OTHER_WORK_ITEM_ID })
    );

    await expect(
      service.createComment(ACTOR_ID, {
        work_item_id: WORK_ITEM_ID,
        parent_id: COMMENT_ID,
        content: CONTENT,
      })
    ).rejects.toBeInstanceOf(CommentReplyScopeError);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it.each(MUTATIONS)(
    'allows an author to $name their comment',
    async (testCase) => {
      const { repository, service } = setup();
      repository.requireProjectMember.mockResolvedValue(
        accessContext({ authorId: ACTOR_ID })
      );

      await testCase.run(service);

      expect(repository[testCase.repositoryMethod]).toHaveBeenCalledOnce();
      expect(getActorUserMock).not.toHaveBeenCalled();
    }
  );

  it.each([UserRoleEnum.admin, UserRoleEnum.manager])(
    'allows an authorized %s moderator to mutate another author comment',
    async (role) => {
      const { repository, service } = setup();
      getActorUserMock.mockResolvedValue({
        id: ACTOR_ID,
        email: 'moderator@example.com',
        role,
      });

      await service.archiveComment(COMMENT_ID, UPDATED_AT, ACTOR_ID);

      expect(repository.requireProjectMember).toHaveBeenCalledWith(
        COMMENT_ID,
        ACTOR_ID
      );
      expect(repository.archive).toHaveBeenCalledOnce();
    }
  );

  it.each(MUTATIONS)(
    'rejects a member attempting to $name another author comment',
    async (testCase) => {
      const { repository, service } = setup();
      getActorUserMock.mockResolvedValue({
        id: ACTOR_ID,
        email: 'member@example.com',
        role: UserRoleEnum.member,
      });

      await expect(testCase.run(service)).rejects.toBeInstanceOf(
        CommentAccessError
      );
      expect(repository[testCase.repositoryMethod]).not.toHaveBeenCalled();
    }
  );

  it('rejects moderation before role evaluation when project access fails', async () => {
    const { repository, service } = setup();
    repository.requireProjectMember.mockRejectedValue(new CommentAccessError());
    getActorUserMock.mockResolvedValue({
      id: ACTOR_ID,
      email: 'admin@example.com',
      role: UserRoleEnum.admin,
    });

    await expect(
      service.archiveComment(COMMENT_ID, UPDATED_AT, ACTOR_ID)
    ).rejects.toBeInstanceOf(CommentAccessError);
    expect(getActorUserMock).not.toHaveBeenCalled();
    expect(repository.archive).not.toHaveBeenCalled();
  });
});
