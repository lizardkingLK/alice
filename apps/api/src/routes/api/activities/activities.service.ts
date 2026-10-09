import type {
  ActivityAction,
  AttachmentActivityMeta,
  EscalationResolvedMeta,
  Json,
  WorkflowTransitionMeta,
} from '@repo/types';
import { serializeActivityValue } from '@repo/types';
import {
  ActivitiesRepository,
  type InsertActivityInput,
} from './activities.repository';

export type FieldChangeDiff = {
  field: string;
  oldValue: unknown;
  newValue: unknown;
};

export class ActivitiesService {
  constructor(private readonly activities: ActivitiesRepository) {}

  async recordCreated(params: {
    workItemId: string;
    actorId: string;
  }): Promise<void> {
    await this.safeInsert([
      {
        workItemId: params.workItemId,
        actorId: params.actorId,
        action: 'created',
      },
    ]);
  }

  async recordFieldChanges(params: {
    workItemId: string;
    actorId: string;
    changes: FieldChangeDiff[];
  }): Promise<void> {
    if (params.changes.length === 0) {
      return;
    }

    await this.safeInsert(
      params.changes.map((change) => ({
        workItemId: params.workItemId,
        actorId: params.actorId,
        action: 'field_changed' as ActivityAction,
        field: change.field,
        oldValue: serializeActivityValue(change.oldValue),
        newValue: serializeActivityValue(change.newValue),
      }))
    );
  }

  async recordWorkflowTransition(params: {
    workItemId: string;
    actorId: string;
    meta: WorkflowTransitionMeta;
  }): Promise<void> {
    await this.safeInsert([
      {
        workItemId: params.workItemId,
        actorId: params.actorId,
        action: 'workflow_transition',
        field: 'state',
        oldValue: params.meta.fromStateId,
        newValue: params.meta.toStateId,
        meta: params.meta as unknown as Json,
      },
    ]);
  }

  async recordEscalationResolved(params: {
    workItemId: string;
    actorId: string;
    meta: EscalationResolvedMeta;
  }): Promise<void> {
    await this.safeInsert([
      {
        workItemId: params.workItemId,
        actorId: params.actorId,
        action: 'escalation_resolved',
        field: 'resolution',
        oldValue: params.meta.fromStateId,
        newValue: params.meta.toStateId,
        meta: params.meta as unknown as Json,
      },
    ]);
  }

  async recordAttachmentAdded(params: {
    workItemId: string;
    actorId: string;
    meta: AttachmentActivityMeta;
  }): Promise<void> {
    await this.safeInsert([
      {
        workItemId: params.workItemId,
        actorId: params.actorId,
        action: 'attachment_added',
        meta: params.meta as unknown as Json,
      },
    ]);
  }

  async recordAttachmentRemoved(params: {
    workItemId: string;
    actorId: string;
    meta: AttachmentActivityMeta;
  }): Promise<void> {
    await this.safeInsert([
      {
        workItemId: params.workItemId,
        actorId: params.actorId,
        action: 'attachment_removed',
        meta: params.meta as unknown as Json,
      },
    ]);
  }

  private async safeInsert(rows: InsertActivityInput[]): Promise<void> {
    try {
      await this.activities.insertMany(rows);
    } catch (err) {
      console.error('error. failed to write work-item activity', err);
    }
  }
}
