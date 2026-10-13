import { normalizeSprintGoal } from '@repo/types';
import type { Prisma } from '@repo/types/prisma';
import {
  prismaAuditCreateWithoutStatus,
  prismaOptionalDate,
} from '../../../lib/prisma-audit';

export type CreateSprintRecord = {
  name: string;
  goal?: string | null;
  startDate: string;
  endDate: string;
  createdBy: string;
  projectId: string;
};

type SprintCreateClient = Pick<Prisma.TransactionClient, 'sprints'>;

/** Insert a sprint through either the global client or an existing transaction. */
export async function insertSprint(
  client: SprintCreateClient,
  input: CreateSprintRecord
) {
  return await client.sprints.create({
    data: {
      name: input.name,
      goal: normalizeSprintGoal(input.goal),
      start_date: prismaOptionalDate(input.startDate)!,
      end_date: prismaOptionalDate(input.endDate)!,
      project_id: input.projectId,
      ...prismaAuditCreateWithoutStatus(input.createdBy),
    },
  });
}
