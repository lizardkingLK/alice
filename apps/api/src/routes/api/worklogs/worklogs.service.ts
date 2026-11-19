import type { WorkItemWorkLog, WorkLogListRow } from '@repo/types';
import type { WorkItemRepository } from '../work-items/work-items.repository';
import { WorkItemValidationError } from '../work-items/work-items.errors';
import {
  createWorklogExcelTemplate,
  parseWorklogExcel,
  type ParsedWorklogExcelRow,
} from './worklogs.excel';
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

  private async requireWritableWorkItem(
    workItemId: string,
    actorId: string
  ): Promise<void> {
    await this.workItems.requireProjectMember(workItemId, actorId);

    const current = await this.workItems.getById(workItemId);
    if (current.status === 'Done') {
      throw new WorkItemValidationError(
        'Done work items are read-only except Status. Change status to log work.'
      );
    }
  }

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
    await this.requireWritableWorkItem(input.workItemId, actorId);

    return await this.worklogsRepository.create({
      workItemId: input.workItemId,
      actorId,
      loggedHours: input.loggedHours,
      loggedAtIso: input.loggedAtIso,
      comment: input.comment,
    });
  }

  async createExcelTemplate(): Promise<Buffer> {
    return await createWorklogExcelTemplate();
  }

  async previewExcelWorklogs(
    actorId: string,
    workItemId: string,
    input: Buffer
  ): Promise<{ rows: ParsedWorklogExcelRow[] }> {
    await this.requireWritableWorkItem(workItemId, actorId);
    return { rows: await parseWorklogExcel(input) };
  }

  async importExcelWorklogs(
    actorId: string,
    workItemId: string,
    input: Buffer
  ): Promise<{ importedCount: number }> {
    await this.requireWritableWorkItem(workItemId, actorId);
    const rows = await parseWorklogExcel(input);
    const importedCount = await this.worklogsRepository.createManyAtomic(
      rows.map((row) => ({
        workItemId,
        actorId,
        loggedHours: row.loggedHours,
        loggedAtIso: row.startAt,
        comment: row.description,
      }))
    );

    return { importedCount };
  }
}
