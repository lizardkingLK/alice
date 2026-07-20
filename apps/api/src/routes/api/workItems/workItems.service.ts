import { DbWorkItem, workItemRepository } from './workItems.repository';
import { WorkItemBody, WorkItemUpdateBody } from './workItems.schemas';

export class WorkItemService {
  async getWorkItems(): Promise<DbWorkItem[]> {
    return await workItemRepository.get();
  }

  async listWorkItems(
    page?: number,
    limit?: number,
    search?: string
  ): Promise<{ workItems: DbWorkItem[]; totalCount: number } | DbWorkItem[]> {
    if (page !== undefined && limit !== undefined) {
      return await workItemRepository.listPaginated(page, limit, search);
    }

    return await workItemRepository.get();
  }

  async getWorkItem(workItemId: string): Promise<DbWorkItem> {
    return await workItemRepository.getById(workItemId);
  }

  async createWorkItem(
    userId: string,
    input: WorkItemBody
  ): Promise<DbWorkItem> {
    return await workItemRepository.create({
      ...input,
      createdBy: userId,
    });
  }

  async updateWorkItem(
    userId: string,
    workItemId: string,
    input: WorkItemUpdateBody
  ): Promise<DbWorkItem> {
    return await workItemRepository.update({
      ...input,
      id: workItemId,
      updatedBy: userId,
    });
  }
}

export const workItemService = new WorkItemService();
