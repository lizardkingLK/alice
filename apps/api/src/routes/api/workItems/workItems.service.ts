import { WorkItemRepository } from './workItems.repository';
import type { DbWorkItem } from './workItems.repository';
import { WorkItemBody, WorkItemUpdateBody } from './workItems.schemas';

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
}
