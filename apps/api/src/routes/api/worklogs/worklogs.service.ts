import type { WorkItemWorkLog, WorkLogListRow } from '@repo/types';
import type { WorkItemRepository } from '../workItems/workItems.repository';
import { WorkItemValidationError } from '../workItems/workItems.errors';
import { WorklogsRepository } from './worklogs.repository';

type WorkItemAccess = Pick<
  WorkItemRepository,
  'requireProjectMember' | 'getById'
>;

export class WorklogsService {
  constructor(
    private readonly worklogsRepository: WorklogsRepository,
    private readonly workItems: WorkItemAccess
  ) {}

  /** Unused Express list path — requires project membership for the work item. */
  async listByWorkItemId(
    workItemId: string,
    actorId: string
  ): Promise<WorkLogListRow[]> {
    await this.workItems.requireProjectMember(workItemId, actorId);
    return await this.worklogsRepository.listByWorkItemId(workItemId);
  }

  async createWorkLog(
    actorId: string,
    input: {
      workItemId: string;
      loggedHours: number;
      loggedAtIso: string;
      comment: string | null;
    }
  ): Promise<WorkItemWorkLog> {
    await this.workItems.requireProjectMember(input.workItemId, actorId);

    const current = await this.workItems.getById(input.workItemId);
    if (current.status === 'Done') {
      throw new WorkItemValidationError(
        'Done work items are read-only except Status. Change status to log work.'
      );
    }

    return await this.worklogsRepository.create({
      workItemId: input.workItemId,
      actorId,
      loggedHours: input.loggedHours,
      loggedAtIso: input.loggedAtIso,
      comment: input.comment,
    });
  }
}
