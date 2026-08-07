import {
  getAllowedChildType,
  type WorkItemType,
  parseWorkItemLabels,
} from '@repo/types';
import { WorkItemRepository } from './workItems.repository';
import type { DbWorkItem } from './workItems.repository';
import { sameNullable } from './workItems.patch-utils';
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
    input: WorkItemUpdateBody,
    expectedUpdatedAt: string
  ): Promise<DbWorkItem> {
    const current = await this.workItems.getById(workItemId);

    if (!sameNullable(input.parent_id, current?.parent_id)) {
      await this.assertValidParentLink({
        parentId: input.parent_id,
        projectId: input.project_id,
        childType: input.type,
        childId: workItemId,
      });
    }

    await this.assertCanBecomeDone(current, workItemId, input.status);
    this.assertDoneIsReadOnlyExceptStatus(current, input);

    return await this.workItems.update({
      ...input,
      id: workItemId,
      updatedBy: userId,
      expectedUpdatedAt,
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
    current: DbWorkItem | null | undefined,
    workItemId: string,
    nextStatus: WorkItemUpdateBody['status']
  ): Promise<void> {
    if (nextStatus !== 'Done') {
      return;
    }

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
  private assertDoneIsReadOnlyExceptStatus(
    current: DbWorkItem | null | undefined,
    input: WorkItemUpdateBody
  ): void {
    if (current?.status !== 'Done') {
      return;
    }

    const dueUnchanged =
      toDateOnly(input.due_date) === toDateOnly(current.due_date);
    const descriptionUnchanged =
      JSON.stringify(input.description ?? null) ===
      JSON.stringify(current.description ?? null);
    const labelsUnchanged =
      JSON.stringify(input.labels ?? parseWorkItemLabels(current.labels)) ===
      JSON.stringify(parseWorkItemLabels(current.labels));

    const nonStatusChanged =
      input.title !== current.title ||
      input.project_id !== current.project_id ||
      input.type !== current.type ||
      input.priority !== current.priority ||
      !sameNullable(input.assignee_id, current.assignee_id) ||
      !sameNullable(input.reporter_id, current.reporter_id) ||
      !dueUnchanged ||
      !sameNullable(input.sprint_id, current.sprint_id) ||
      !sameNullable(input.story_points, current.story_points) ||
      !sameNullable(input.parent_id, current.parent_id) ||
      !descriptionUnchanged ||
      !labelsUnchanged ||
      !sameNullable(input.jira_issue_key, current.jira_issue_key);

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
