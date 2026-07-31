import { getAllowedChildType, type WorkItemType } from '@repo/types';
import { WorkItemRepository } from './workItems.repository';
import type { DbWorkItem } from './workItems.repository';
import { WorkItemBody, WorkItemUpdateBody } from './workItems.schemas';

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
    return await this.workItems.createWorkItemWorkLog({
      workItemId,
      actorId,
      loggedHours: input.loggedHours,
      loggedAtIso: input.loggedAtIso,
      comment: input.comment,
    });
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
