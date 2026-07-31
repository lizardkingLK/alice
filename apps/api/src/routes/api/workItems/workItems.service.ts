import { getAllowedChildType, type WorkItemType } from '@repo/types';
import { WorkItemRepository } from './workItems.repository';
import type { DbWorkItem } from './workItems.repository';
import {
  toDateOnly,
  WorkItemBody,
  WorkItemUpdateBody,
} from './workItems.schemas';

export class WorkItemValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkItemValidationError';
  }
}

export class WorkItemService {
  constructor(private readonly workItems: WorkItemRepository) {}

  async getWorkItems(filters?: {
    sprint_id?: string | null;
  }): Promise<DbWorkItem[]> {
    return await this.workItems.get(filters);
  }

  async listWorkItems(
    page?: number,
    limit?: number,
    search?: string,
    filters?: { sprint_id?: string | null }
  ): Promise<{ workItems: DbWorkItem[]; totalCount: number } | DbWorkItem[]> {
    if (page !== undefined && limit !== undefined) {
      return await this.workItems.listPaginated(page, limit, search, filters);
    }

    return await this.workItems.get(filters);
  }

  async getWorkItem(workItemId: string): Promise<DbWorkItem> {
    return await this.workItems.getById(workItemId);
  }

  async createWorkItem(
    userId: string,
    input: WorkItemBody
  ): Promise<DbWorkItem> {
    await this.assertValidParentLink({
      parentId: input.parent_id,
      projectId: input.project_id,
      childType: input.type,
    });

    return await this.workItems.create({
      ...input,
      createdBy: userId,
    });
  }

  async updateWorkItem(
    userId: string,
    workItemId: string,
    input: WorkItemUpdateBody
  ): Promise<DbWorkItem> {
    await this.assertValidParentLink({
      parentId: input.parent_id,
      projectId: input.project_id,
      childType: input.type,
      childId: workItemId,
    });

    await this.assertCanBecomeDone(workItemId, input.status);
    await this.assertDoneIsReadOnlyExceptStatus(workItemId, input);

    return await this.workItems.update({
      ...input,
      id: workItemId,
      updatedBy: userId,
    });
  }

  async listWorkItemWorkLogs(actorId: string, workItemId: string) {
    return await this.workItems.listWorkItemWorkLogs(workItemId, actorId);
  }

  async createWorkItemWorkLog(
    actorId: string,
    workItemId: string,
    input: {
      loggedHours: number;
      loggedAtIso: string;
      comment: string | null;
    }
  ) {
    const current = await this.workItems.getById(workItemId);
    if (current?.status === 'Done') {
      throw new WorkItemValidationError(
        'Done work items are read-only except Status. Change status to log work.'
      );
    }

    return await this.workItems.createWorkItemWorkLog({
      workItemId,
      actorId,
      loggedHours: input.loggedHours,
      loggedAtIso: input.loggedAtIso,
      comment: input.comment,
    });
  }

  private async assertCanBecomeDone(
    workItemId: string,
    nextStatus: WorkItemUpdateBody['status']
  ): Promise<void> {
    if (nextStatus !== 'Done') {
      return;
    }

    const current = await this.workItems.getById(workItemId);
    if (!current || current.status === 'Done') {
      return;
    }

    const incompleteCount =
      await this.workItems.countIncompleteChildren(workItemId);
    if (incompleteCount > 0) {
      throw new WorkItemValidationError(
        `Cannot mark as Done while ${incompleteCount} subtask${incompleteCount === 1 ? ' is' : 's are'} incomplete. Complete or unlink them first.`
      );
    }
  }

  /** Done records accept Status changes only (reopen or keep Done). */
  private async assertDoneIsReadOnlyExceptStatus(
    workItemId: string,
    input: WorkItemUpdateBody
  ): Promise<void> {
    const current = await this.workItems.getById(workItemId);
    if (current?.status !== 'Done') {
      return;
    }

    const dueUnchanged =
      toDateOnly(input.due_date) === toDateOnly(current.due_date);
    const parentUnchanged =
      (input.parent_id ?? null) === (current.parent_id ?? null);

    const nonStatusChanged =
      input.title !== current.title ||
      input.project_id !== current.project_id ||
      input.type !== current.type ||
      (input.assignee_id ?? null) !== (current.assignee_id ?? null) ||
      (input.reporter_id ?? null) !== (current.reporter_id ?? null) ||
      !dueUnchanged ||
      (input.sprint_id ?? null) !== (current.sprint_id ?? null) ||
      (input.story_points ?? null) !== (current.story_points ?? null) ||
      !parentUnchanged;

    if (nonStatusChanged) {
      throw new WorkItemValidationError(
        'Done work items are read-only except Status. Change status to edit other fields.'
      );
    }
  }

  private async assertValidParentLink(params: {
    parentId?: string | null;
    projectId: string;
    childType: WorkItemType;
    childId?: string;
  }): Promise<void> {
    const { parentId, projectId, childType, childId } = params;

    if (parentId == null) {
      return;
    }

    if (childId && parentId === childId) {
      throw new WorkItemValidationError('A work item cannot be its own parent');
    }

    const parent = await this.workItems.getById(parentId);
    if (!parent) {
      throw new WorkItemValidationError('Parent work item not found');
    }

    if (parent.project_id !== projectId) {
      throw new WorkItemValidationError(
        'Subtask must belong to the same project as its parent'
      );
    }

    const allowedChildType = getAllowedChildType(parent.type as WorkItemType);
    if (!allowedChildType) {
      throw new WorkItemValidationError(
        `Parent of type ${parent.type} cannot have subtasks`
      );
    }

    if (childType !== allowedChildType) {
      throw new WorkItemValidationError(
        `Parent of type ${parent.type} only allows child type ${allowedChildType}`
      );
    }
  }
}
