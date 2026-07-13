import { DbWorkItem, workItemRepository } from './workItems.repository';
import { WorkItemBody } from './workItems.schemas';

export class WorkItemService {
  async listWorkItems(): Promise<DbWorkItem[]> {
    return await workItemRepository.listAll();
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
    input: WorkItemBody
  ): Promise<DbWorkItem> {
    return await workItemRepository.update({
      ...input,
      id: workItemId,
      updatedBy: userId,
    });
  }
}

export const workItemService = new WorkItemService();
