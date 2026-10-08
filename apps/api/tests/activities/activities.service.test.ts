import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActivitiesService } from '../../src/routes/api/activities/activities.service';
import type { ActivitiesRepository } from '../../src/routes/api/activities/activities.repository';

const insertManyMock = vi.fn();

const repository = {
  insertMany: insertManyMock,
} as unknown as ActivitiesRepository;

describe('ActivitiesService', () => {
  beforeEach(() => {
    insertManyMock.mockReset();
    insertManyMock.mockResolvedValue(undefined);
  });

  it('records created activity', async () => {
    // Arrange
    const service = new ActivitiesService(repository);

    // Act
    await service.recordCreated({
      workItemId: 'wi-1',
      actorId: 'user-1',
    });

    // Assert
    expect(insertManyMock).toHaveBeenCalledWith([
      expect.objectContaining({
        workItemId: 'wi-1',
        actorId: 'user-1',
        action: 'created',
      }),
    ]);
  });

  it('records field changes with serialized values', async () => {
    // Arrange
    const service = new ActivitiesService(repository);

    // Act
    await service.recordFieldChanges({
      workItemId: 'wi-1',
      actorId: 'user-1',
      changes: [
        { field: 'title', oldValue: 'Old', newValue: 'New' },
        { field: 'assignee_id', oldValue: null, newValue: 'user-2' },
      ],
    });

    // Assert
    expect(insertManyMock).toHaveBeenCalledWith([
      expect.objectContaining({
        action: 'field_changed',
        field: 'title',
        oldValue: 'Old',
        newValue: 'New',
      }),
      expect.objectContaining({
        action: 'field_changed',
        field: 'assignee_id',
        oldValue: null,
        newValue: 'user-2',
      }),
    ]);
  });

  it('skips field changes when the list is empty', async () => {
    // Arrange
    const service = new ActivitiesService(repository);

    // Act
    await service.recordFieldChanges({
      workItemId: 'wi-1',
      actorId: 'user-1',
      changes: [],
    });

    // Assert
    expect(insertManyMock).not.toHaveBeenCalled();
  });

  it('records workflow transition meta', async () => {
    // Arrange
    const service = new ActivitiesService(repository);

    // Act
    await service.recordWorkflowTransition({
      workItemId: 'wi-1',
      actorId: 'user-1',
      meta: {
        fromStateId: 'st-new',
        toStateId: 'st-done',
        workflowId: 'wf-default',
        edgeId: 'e-1',
      },
    });

    // Assert
    expect(insertManyMock).toHaveBeenCalledWith([
      expect.objectContaining({
        action: 'workflow_transition',
        field: 'state',
        oldValue: 'st-new',
        newValue: 'st-done',
        meta: expect.objectContaining({
          fromStateId: 'st-new',
          toStateId: 'st-done',
          workflowId: 'wf-default',
          edgeId: 'e-1',
        }),
      }),
    ]);
  });

  it('records attachment added and removed', async () => {
    // Arrange
    const service = new ActivitiesService(repository);

    // Act
    await service.recordAttachmentAdded({
      workItemId: 'wi-1',
      actorId: 'user-1',
      meta: { attachmentId: 'att-1', fileName: 'spec.pdf' },
    });
    await service.recordAttachmentRemoved({
      workItemId: 'wi-1',
      actorId: 'user-1',
      meta: { attachmentId: 'att-1', fileName: 'spec.pdf' },
    });

    // Assert
    expect(insertManyMock).toHaveBeenNthCalledWith(1, [
      expect.objectContaining({
        action: 'attachment_added',
        meta: { attachmentId: 'att-1', fileName: 'spec.pdf' },
      }),
    ]);
    expect(insertManyMock).toHaveBeenNthCalledWith(2, [
      expect.objectContaining({
        action: 'attachment_removed',
        meta: { attachmentId: 'att-1', fileName: 'spec.pdf' },
      }),
    ]);
  });

  it('swallows repository errors so mutations still succeed', async () => {
    // Arrange
    insertManyMock.mockRejectedValue(new Error('db down'));
    const service = new ActivitiesService(repository);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Act + Assert
    await expect(
      service.recordCreated({ workItemId: 'wi-1', actorId: 'user-1' })
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
