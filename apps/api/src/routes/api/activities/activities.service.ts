import {
  type ActivityAction,
  type AttachmentActivityMeta,
  type EscalationResolvedMeta,
  type Json,
  type WorkflowTransitionMeta,
  serializeActivityValue,
} from '@repo/types';
import {
  ActivitiesRepository,
  type InsertActivityInput,
} from './activities.repository';

export type FieldChangeDiff = {
  field: string;
  oldValue: unknown;
  newValue: unknown;
};

function toWorkflowTransitionRow(
  workItemId: string,
  actorId: string,
  meta: WorkflowTransitionMeta
): InsertActivityInput {
  return {
    workItemId,
    actorId,
    action: 'workflow_transition',
    field: 'state',
    oldValue: meta.fromStateId,
    newValue: meta.toStateId,
    meta: meta as unknown as Json,
  };
}

function toEscalationResolvedRow(
  workItemId: string,
  actorId: string,
  meta: EscalationResolvedMeta
): InsertActivityInput {
  return {
    workItemId,
    actorId,
    action: 'escalation_resolved',
    field: 'resolution',
    oldValue: meta.fromStateId,
    newValue: meta.toStateId,
    meta: meta as unknown as Json,
  };
}

function toFieldChangeRows(
  workItemId: string,
  actorId: string,
  changes: FieldChangeDiff[]
): InsertActivityInput[] {
  return changes.map((change) => ({
    workItemId,
    actorId,
    action: 'field_changed' as ActivityAction,
    field: change.field,
    oldValue: serializeActivityValue(change.oldValue),
    newValue: serializeActivityValue(change.newValue),
  }));
}

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
      toFieldChangeRows(params.workItemId, params.actorId, params.changes)
    );
  }

  async recordWorkflowTransition(params: {
    workItemId: string;
    actorId: string;
    meta: WorkflowTransitionMeta;
  }): Promise<void> {
    await this.safeInsert([
      toWorkflowTransitionRow(params.workItemId, params.actorId, params.meta),
    ]);
  }

  async recordEscalationResolved(params: {
    workItemId: string;
    actorId: string;
    meta: EscalationResolvedMeta;
  }): Promise<void> {
    await this.safeInsert([
      toEscalationResolvedRow(params.workItemId, params.actorId, params.meta),
    ]);
  }

  /**
   * One `createMany` for transition + escalation + field diffs on a PATCH.
   * Prefer this over sequential `recordWorkflowTransition` / `recordFieldChanges`.
   */
  async recordWorkItemUpdate(params: {
    workItemId: string;
    actorId: string;
    workflowTransition?: WorkflowTransitionMeta | null;
    escalationResolved?: EscalationResolvedMeta | null;
    fieldChanges: FieldChangeDiff[];
  }): Promise<void> {
    const rows: InsertActivityInput[] = [];

    if (params.workflowTransition) {
      rows.push(
        toWorkflowTransitionRow(
          params.workItemId,
          params.actorId,
          params.workflowTransition
        )
      );
    }

    if (params.escalationResolved) {
      rows.push(
        toEscalationResolvedRow(
          params.workItemId,
          params.actorId,
          params.escalationResolved
        )
      );
    }

    rows.push(
      ...toFieldChangeRows(
        params.workItemId,
        params.actorId,
        params.fieldChanges
      )
    );

    await this.safeInsert(rows);
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
