import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkItemService } from '../../src/routes/api/workItems/workItems.service';
import type { WorkItemRepository } from '../../src/routes/api/workItems/workItems.repository';
import { WorkItemValidationError } from '../../src/routes/api/workItems/workItems.errors';

const {
  getByIdMock,
  requireProjectMemberMock,
  collectDescendantIdsMock,
  setRecordStatusForSubtreeMock,
  listAttachmentStoragePathsMock,
  deleteNotificationsForWorkItemsMock,
  deleteWorkItemsByIdsMock,
  requireUserWithRoleMock,
  removeStorageObjectsMock,
} = vi.hoisted(() => ({
  getByIdMock: vi.fn(),
  requireProjectMemberMock: vi.fn(),
  collectDescendantIdsMock: vi.fn(),
  setRecordStatusForSubtreeMock: vi.fn(),
  listAttachmentStoragePathsMock: vi.fn(),
  deleteNotificationsForWorkItemsMock: vi.fn(),
  deleteWorkItemsByIdsMock: vi.fn(),
  requireUserWithRoleMock: vi.fn(),
  removeStorageObjectsMock: vi.fn(),
}));

vi.mock('../../src/lib/auth-helpers', () => ({
  requireUserWithRole: requireUserWithRoleMock,
}));

vi.mock('../../src/lib/file-helpers', () => ({
  removeStorageObjects: removeStorageObjectsMock,
}));

vi.mock('../../src/config/env', () => ({
  env: {
    STORAGE_BUCKET_ATTACHMENTS: 'attachments',
  },
}));

const repository = {
  getById: getByIdMock,
  requireProjectMember: requireProjectMemberMock,
  collectDescendantIds: collectDescendantIdsMock,
  setRecordStatusForSubtree: setRecordStatusForSubtreeMock,
  listAttachmentStoragePaths: listAttachmentStoragePathsMock,
  deleteNotificationsForWorkItems: deleteNotificationsForWorkItemsMock,
  deleteWorkItemsByIds: deleteWorkItemsByIdsMock,
} as unknown as WorkItemRepository;

const service = new WorkItemService(repository);

const ROOT_ID = 'wi-root';
const CHILD_ID = 'wi-child';
const ACTOR = 'user-1';
const LOCK = '2026-08-01T00:00:00.000Z';

function activeRoot(overrides: Record<string, unknown> = {}) {
  return {
    id: ROOT_ID,
    record_status: 'active',
    updated_at: LOCK,
    ...overrides,
  };
}

describe('WorkItemService archive / restore / purge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireProjectMemberMock.mockResolvedValue({ projectId: 'proj-1' });
    requireUserWithRoleMock.mockResolvedValue({ id: ACTOR, role: 'admin' });
  });

  it('archives the subtree via setRecordStatusForSubtree', async () => {
    getByIdMock.mockResolvedValue(activeRoot());
    setRecordStatusForSubtreeMock.mockResolvedValue(
      activeRoot({ record_status: 'archived' })
    );

    await expect(
      service.archiveWorkItem(ACTOR, ROOT_ID, LOCK)
    ).resolves.toMatchObject({ record_status: 'archived' });

    expect(setRecordStatusForSubtreeMock).toHaveBeenCalledWith(
      ROOT_ID,
      'archived',
      ACTOR,
      LOCK,
      { unlinkFromParent: false }
    );
  });

  it('rejects archive when already archived', async () => {
    getByIdMock.mockResolvedValue(activeRoot({ record_status: 'archived' }));

    await expect(
      service.archiveWorkItem(ACTOR, ROOT_ID, LOCK)
    ).rejects.toBeInstanceOf(WorkItemValidationError);
    expect(setRecordStatusForSubtreeMock).not.toHaveBeenCalled();
  });

  it('restores an archived subtree', async () => {
    getByIdMock.mockResolvedValue(activeRoot({ record_status: 'archived' }));
    setRecordStatusForSubtreeMock.mockResolvedValue(activeRoot());

    await expect(
      service.restoreWorkItem(ACTOR, ROOT_ID, LOCK)
    ).resolves.toMatchObject({ record_status: 'active' });

    expect(setRecordStatusForSubtreeMock).toHaveBeenCalledWith(
      ROOT_ID,
      'active',
      ACTOR,
      LOCK,
      { unlinkFromParent: false }
    );
  });

  it('restores an archived child and unlinks it from its parent', async () => {
    getByIdMock.mockResolvedValue(
      activeRoot({
        id: CHILD_ID,
        record_status: 'archived',
        parent_id: ROOT_ID,
      })
    );
    setRecordStatusForSubtreeMock.mockResolvedValue(
      activeRoot({ id: CHILD_ID, parent_id: null })
    );

    await expect(
      service.restoreWorkItem(ACTOR, CHILD_ID, LOCK)
    ).resolves.toMatchObject({ parent_id: null });

    expect(setRecordStatusForSubtreeMock).toHaveBeenCalledWith(
      CHILD_ID,
      'active',
      ACTOR,
      LOCK,
      { unlinkFromParent: true }
    );
  });

  it('rejects restore when not archived', async () => {
    getByIdMock.mockResolvedValue(activeRoot());

    await expect(
      service.restoreWorkItem(ACTOR, ROOT_ID, LOCK)
    ).rejects.toBeInstanceOf(WorkItemValidationError);
  });

  it('purges archived subtree: notifications, rows, then storage', async () => {
    getByIdMock.mockResolvedValue(activeRoot({ record_status: 'archived' }));
    collectDescendantIdsMock.mockResolvedValue([ROOT_ID, CHILD_ID]);
    listAttachmentStoragePathsMock.mockResolvedValue(['a/path.png']);
    deleteNotificationsForWorkItemsMock.mockResolvedValue(undefined);
    deleteWorkItemsByIdsMock.mockResolvedValue(undefined);
    removeStorageObjectsMock.mockResolvedValue(undefined);

    await expect(service.purgeWorkItem(ACTOR, ROOT_ID)).resolves.toEqual({
      deletedIds: [ROOT_ID, CHILD_ID],
      descendantCount: 1,
    });

    expect(requireUserWithRoleMock).toHaveBeenCalled();
    expect(deleteNotificationsForWorkItemsMock).toHaveBeenCalledWith([
      ROOT_ID,
      CHILD_ID,
    ]);
    expect(deleteWorkItemsByIdsMock).toHaveBeenCalledWith([ROOT_ID, CHILD_ID]);
    expect(removeStorageObjectsMock).toHaveBeenCalledWith('attachments', [
      'a/path.png',
    ]);
  });

  it('rejects purge when not archived', async () => {
    getByIdMock.mockResolvedValue(activeRoot());

    await expect(service.purgeWorkItem(ACTOR, ROOT_ID)).rejects.toBeInstanceOf(
      WorkItemValidationError
    );
    expect(deleteWorkItemsByIdsMock).not.toHaveBeenCalled();
  });

  it('rejects purge for non-admin actors', async () => {
    requireUserWithRoleMock.mockRejectedValue(new Error('Unauthorized'));

    await expect(service.purgeWorkItem(ACTOR, ROOT_ID)).rejects.toThrow(
      'Unauthorized'
    );
    expect(deleteWorkItemsByIdsMock).not.toHaveBeenCalled();
  });

  it('counts descendants excluding the root', async () => {
    collectDescendantIdsMock.mockResolvedValue([ROOT_ID, CHILD_ID, 'wi-2']);

    await expect(service.countDescendants(ROOT_ID, ACTOR)).resolves.toBe(2);
    expect(requireProjectMemberMock).toHaveBeenCalledWith(ROOT_ID, ACTOR);
  });
});
